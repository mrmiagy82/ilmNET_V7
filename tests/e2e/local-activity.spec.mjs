/**
 * Fase D5 — the device-local activity store, without a browser.
 *
 * `src/lib/localActivity.ts` is the only module in the frontend that touches `localStorage`, and the
 * decisions it makes (what counts as a valid entry, when a remembered position may be offered, when a
 * corrupt value is thrown away) are pure logic that a browser run could only cover by accident. This
 * suite loads the real module with the TypeScript compiler and drives it against a fake storage —
 * the same approach `tests/e2e/brand.spec.mjs` uses for the shared brand component.
 *
 * No database, no server, no browser: it checks the contract, the corruption handling and the resume
 * rules. The browser side of D5 (the Continue rail, the "More like this" rail, the real audio resume)
 * is covered by the phase's own browser check.
 *
 *   node tests/e2e/local-activity.spec.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MODULE = path.join(ROOT, 'src/lib/localActivity.ts');

let passed = 0;
let failed = 0;
const check = (condition, label) => {
  if (condition) {
    passed++;
    console.log(`✅ ${label}`);
  } else {
    failed++;
    console.log(`❌ ${label}`);
  }
};

/** A `localStorage` good enough for the module: same shape, in memory, with a working quota error. */
class FakeStorage {
  constructor() {
    this.map = new Map();
    this.failOnWrite = false;
  }
  get length() {
    return this.map.size;
  }
  key(i) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    if (this.failOnWrite) throw new Error('QuotaExceededError');
    this.map.set(key, String(value));
  }
  removeItem(key) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

const source = await readFile(MODULE, 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

/** Loads a fresh copy of the module against the given fake storage (and a fixed clock when asked). */
function loadModule(storage, now) {
  const module = { exports: {} };
  const sandboxGlobal = { localStorage: storage };
  if (now !== undefined) sandboxGlobal.Date = { now: () => now };
  const fn = new Function('require', 'module', 'exports', 'globalThis', 'window', js);
  fn(createRequire(import.meta.url), module, module.exports, sandboxGlobal, sandboxGlobal);
  return module.exports;
}

const KEY = 'ilmnet.local-activity.v1';
const HOUR = 60 * 60 * 1000;

console.log('--- 1. Opslaan en ophalen ---');
{
  const store = new FakeStorage();
  const la = loadModule(store);
  const audio = { id: 'c1', slug: 'audio-een', type: 'audio' };
  const book = { id: 'c2', slug: 'boek-twee', type: 'book' };
  const lecture = { id: 'c3', slug: 'lezing-drie', type: 'lecture' };

  la.recordOpen(audio);
  la.recordOpen(book);
  const last = la.recordOpen(lecture);

  check(store.map.has(KEY), 'an open is written under the versioned key');
  check(last && last.kind === 'media', `a lecture is stored as media (${last && last.kind})`);
  const stored = la.readActivity();
  check(stored.length === 3, `all three entries come back (${stored.length})`);
  check(stored[0].id === 'c3', 'the most recent open is first');
  check(la.getActivityEntry('c2').kind === 'book', 'a book is remembered as a book');
  check(la.getActivityEntry('c2').slug === 'boek-twee', 'the slug is kept, so the link needs no request');
  check(!('title' in la.getActivityEntry('c2')), 'no title or other content copy is stored');
  check(JSON.stringify(stored).length < 600, `the whole store stays tiny (${JSON.stringify(stored).length} bytes for 3 entries)`);
  check(store.getItem(KEY).includes('"id":"c1"'), 'the value on disk is readable JSON, not an opaque blob');
}

console.log('--- 2. Wissen ---');
{
  const store = new FakeStorage();
  const la = loadModule(store);
  la.recordOpen({ id: 'c1', slug: 'a', type: 'lecture' });
  la.recordPlayback({ id: 'c1', slug: 'a', positionSec: 120, durationSec: 600 });
  check(la.readActivity().length === 1, 'there is something to clear');

  la.clearActivity();
  check(store.getItem(KEY) === null, 'clearing removes the key itself, not just its contents');
  check(la.readActivity().length === 0, 'and reading afterwards returns nothing');

  // Een enkele id vergeten (content bestaat niet meer) laat de rest staan.
  la.recordOpen({ id: 'c1', slug: 'a', type: 'lecture' });
  la.recordOpen({ id: 'c2', slug: 'b', type: 'book' });
  la.forgetActivity('c1');
  const left = la.readActivity();
  check(left.length === 1 && left[0].id === 'c2', `forgetting one id keeps the others (${left.map((e) => e.id).join(', ')})`);
  la.forgetActivity('c2');
  check(store.getItem(KEY) === null, 'forgetting the last id removes the key as well');
}

console.log('--- 3. Corrupte of onbruikbare opslag ---');
{
  const store = new FakeStorage();
  const la = loadModule(store);

  store.setItem(KEY, '{not json');
  check(la.readActivity().length === 0, 'truncated JSON yields an empty list instead of a throw');
  check(store.getItem(KEY) === null, 'and the unusable value is removed');

  store.setItem(KEY, '{"id":"c1"}');
  check(la.readActivity().length === 0, 'a JSON object where a list belongs is not read as history');

  store.setItem(KEY, JSON.stringify([{ id: 'c1' }, { slug: 'x' }, null, 42, 'text']));
  check(la.readActivity().length === 0, 'entries with missing fields are dropped individually');

  store.setItem(
    KEY,
    JSON.stringify([
      { id: 'ok', slug: 'oke', kind: 'book', lastOpenedAt: Date.now() },
      { id: 'bad-kind', slug: 'x', kind: 'video', lastOpenedAt: Date.now() },
      { id: 'bad-time', slug: 'x', kind: 'book', lastOpenedAt: 'gisteren' },
      { id: 'future', slug: 'x', kind: 'book', lastOpenedAt: Date.now() + 10 * HOUR },
      { id: 'nan-position', slug: 'x', kind: 'audio', lastOpenedAt: Date.now(), positionSec: Number.NaN, durationSec: 100 },
    ]),
  );
  const kept = la.readActivity();
  check(
    kept.length === 2 && kept.some((e) => e.id === 'ok') && kept.some((e) => e.id === 'nan-position'),
    `the valid entries survive, the unusable kinds and timestamps do not (${kept.map((e) => e.id).join(', ') || 'none'})`,
  );
  const fromStorage = kept.find((e) => e.id === 'nan-position');
  check(fromStorage.positionSec === undefined, 'a position that is not a number is not carried into the store');
  check(la.resumePointFor(fromStorage, 'nan-position') === null, 'and it can never become a resume point');

  // Een browser die opslag weigert mag nooit een fout opleveren.
  const hostile = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('blocked');
    },
    removeItem() {
      throw new Error('blocked');
    },
  };
  const blocked = loadModule(hostile);
  blocked.recordOpen({ id: 'c1', slug: 'a', type: 'audio' });
  check(blocked.readActivity().length === 0, 'a browser that refuses storage simply remembers nothing');
  check(blocked.storageAvailable() === false, 'and the module reports that storage is unavailable');

  const quota = new FakeStorage();
  quota.failOnWrite = true;
  const full = loadModule(quota);
  full.recordOpen({ id: 'c1', slug: 'a', type: 'audio' });
  check(full.readActivity().length === 0, 'a full quota is swallowed, not thrown at the visitor');
}

console.log('--- 4. Volgorde, limiet en houdbaarheid ---');
{
  const store = new FakeStorage();
  const la = loadModule(store);
  const now = 1_700_000_000_000;

  for (let i = 0; i < 30; i++) {
    la.recordOpen({ id: `c${i}`, slug: `s${i}`, type: 'lecture' }, now + i * 1000);
  }
  const capped = la.readActivity(now + 30_000);
  check(capped.length === 20, `the list is capped at 20 entries (${capped.length})`);
  check(capped[0].id === 'c29', 'the newest entry is first');
  check(!capped.some((e) => e.id === 'c0'), 'the oldest entries fall off the end');

  const reopened = la.recordOpen({ id: 'c5', slug: 's5', type: 'lecture' }, now + 40_000);
  check(reopened.lastOpenedAt === now + 40_000, 'opening the same item again updates its timestamp');
  check(la.readActivity(now + 40_000)[0].id === 'c5', 'and moves it back to the front');
  check(la.readActivity(now + 40_000).filter((e) => e.id === 'c5').length === 1, 'without duplicating it');

  const old = now - 200 * 24 * HOUR;
  la.recordOpen({ id: 'ancient', slug: 'oud', type: 'book' }, old);
  check(!la.readActivity(now).some((e) => e.id === 'ancient'), 'an entry past the retention window is dropped');

  // Een bestaande positie blijft staan wanneer je het item opnieuw opent zonder te spelen.
  la.recordPlayback({ id: 'c9', slug: 's9', positionSec: 300, durationSec: 900 }, now + 50_000);
  la.recordOpen({ id: 'c9', slug: 's9', type: 'audio' }, now + 60_000);
  check(la.getActivityEntry('c9', now + 60_000).positionSec === 300, 'reopening an audio item does not lose the saved position');
}

console.log('--- 5. Echte playbackposities: wat wel en niet bewaard wordt ---');
{
  const store = new FakeStorage();
  const la = loadModule(store);

  la.recordPlayback({ id: 'a1', slug: 'audio', positionSec: 240, durationSec: 1200 });
  const stored = la.getActivityEntry('a1');
  check(stored.kind === 'audio', 'playback is only ever stored as audio');
  check(stored.positionSec === 240 && stored.durationSec === 1200, 'the real position and duration are kept');

  la.recordPlayback({ id: 'a2', slug: 'audio2', positionSec: Number.NaN, durationSec: 600 });
  check(la.getActivityEntry('a2') === null, 'a position that is not a number is refused');
  la.recordPlayback({ id: 'a3', slug: 'audio3', positionSec: 30, durationSec: 0 });
  check(la.getActivityEntry('a3') === null, 'a position without a real duration is refused');
  la.recordPlayback({ id: 'a4', slug: 'audio4', positionSec: 900, durationSec: 600 });
  check(la.getActivityEntry('a4') === null, 'a position past the end of the file is refused');
  la.recordPlayback({ id: 'a5', slug: 'audio5', positionSec: -5, durationSec: 600 });
  check(la.getActivityEntry('a5') === null, 'a negative position is refused');
}

console.log('--- 6. Resume: alleen de juiste content, alleen een zinvolle positie ---');
{
  const store = new FakeStorage();
  const la = loadModule(store);
  const now = 1_700_000_000_000;
  la.recordPlayback({ id: 'audio-1', slug: 'audio-1', positionSec: 245.7, durationSec: 1800 }, now);
  const entry = la.getActivityEntry('audio-1', now);

  const point = la.resumePointFor(entry, 'audio-1');
  check(point && point.positionSec === 245, `a real position is offered, rounded to the second (${point && point.positionSec})`);
  check(la.resumePointFor(entry, 'audio-2') === null, 'the same entry is not offered for a different item');
  check(la.resumePointFor(null, 'audio-1') === null, 'no entry means no resume');
  check(la.resumePointFor(undefined, 'audio-1') === null, 'an undefined entry means no resume');

  const short = { id: 'audio-3', slug: 'audio-3', kind: 'audio', lastOpenedAt: now, positionSec: 5, durationSec: 1800 };
  check(la.resumePointFor(short, 'audio-3') === null, 'a few seconds in is not a position worth resuming');

  const nearEnd = { id: 'audio-4', slug: 'audio-4', kind: 'audio', lastOpenedAt: now, positionSec: 1790, durationSec: 1800 };
  check(la.resumePointFor(nearEnd, 'audio-4') === null, 'the last seconds are not offered as "continue"');

  const noDuration = { id: 'audio-5', slug: 'audio-5', kind: 'audio', lastOpenedAt: now, positionSec: 300 };
  check(la.resumePointFor(noDuration, 'audio-5') === null, 'without a real duration there is no resume');

  const book = { id: 'book-1', slug: 'boek', kind: 'book', lastOpenedAt: now, positionSec: 300, durationSec: 900 };
  check(la.resumePointFor(book, 'book-1') === null, 'a book entry is never treated as audio progress');
}

console.log('--- 7. Routes en soorten ---');
{
  const store = new FakeStorage();
  const la = loadModule(store);
  check(la.detailPathFor('book', 'tafsir-1') === '/books/tafsir-1', 'a book links to the book route');
  check(la.detailPathFor('media', 'lezing') === '/lectures/lezing', 'a lecture links to the lecture route');
  check(la.detailPathFor('audio', 'a b') === '/lectures/a%20b', 'a slug with a space is encoded');
  check(la.kindForType('document') === 'book', 'a document counts as a book');
  check(la.kindForType('audio') === 'audio', 'audio stays audio');
  check(la.kindForType('video') === 'media' && la.kindForType('lecture') === 'media', 'video and lecture are media');
  check(la.detailPathFor('audio', 'x').startsWith('/lectures/'), 'an audio item lives under the lecture route, as the library links it');
}

console.log(`\n${failed === 0 ? '✅' : '❌'} local activity: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
