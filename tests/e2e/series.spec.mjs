/**
 * Fase D6 — the collection grouping, without a browser or a server.
 *
 * `src/lib/series.ts` turns a list of library records into "series" (a `collectionIdentifier` on the
 * records and nothing else) and standalone items. The one decision that matters — the order of the
 * items inside a series — is pure logic that a browser run can only cover by accident: the old code
 * re-sorted items A–Z while the page drew positional badges over them, which made an unordered
 * collection look like a numbered course. D6 removed that sort, so this suite pins it down.
 *
 * This spec loads the real module with the TypeScript compiler and drives it against records shaped
 * exactly like `/api/contents` returns them — the same approach as `tests/e2e/local-activity.spec.mjs`.
 *
 *   node tests/e2e/series.spec.mjs
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ts from 'typescript';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MODULE = path.join(ROOT, 'src/lib/series.ts');

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

const source = await readFile(MODULE, 'utf8');
// Target and downlevelIteration matter here: the group loop walks a Map with `for…of`, which the ES5
// default of `transpileModule` rewrites into a `.length` walk that never runs (the app builds for a
// modern target, so this suite compiles the same way).
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', js)(createRequire(import.meta.url), module, module.exports);
const { groupByCollection, getDownloadUrl, getAudioStreamUrl } = module.exports;

/** A record with the fields the grouping reads, shaped like the API's payload. */
const record = (over = {}) => ({
  id: over.id ?? over.title ?? 'id',
  title: over.title ?? 'Untitled',
  slug: over.slug ?? 'slug',
  type: over.type ?? 'video',
  provider: over.provider ?? 'youtube',
  externalIdentifier: over.externalIdentifier ?? null,
  collectionIdentifier: over.collectionIdentifier ?? null,
  collectionTitle: over.collectionTitle ?? null,
  series: over.series ?? null,
  description: over.description ?? null,
  thumbnailUrl: over.thumbnailUrl ?? null,
  coverUrl: over.coverUrl ?? null,
  sourceUrl: over.sourceUrl ?? 'https://example.invalid/x',
  embedUrl: over.embedUrl ?? null,
  updatedAt: over.updatedAt ?? '2026-01-01T00:00:00.000Z',
  subjects: over.subjects ?? [],
  scholars: over.scholars ?? [],
});

const subject = (id, name, accent = 'plain') => ({ subject: { id, name, accent } });
const scholar = (id, name) => ({ scholar: { id, name } });

console.log('--- 1. Groeperen: wat een serie is en wat niet ---');
{
  const { series, standalone } = groupByCollection([
    record({ title: 'Een', collectionIdentifier: 'reeks-a' }),
    record({ title: 'Twee', collectionIdentifier: 'reeks-a' }),
    record({ title: 'Los' }),
    record({ title: 'Alleen', collectionIdentifier: 'reeks-eenling' }),
  ]);

  check(series.length === 1, `only the collection with two or more items becomes a series (${series.length})`);
  check(series[0].id === 'reeks-a', 'the series keeps the collection identifier as its id');
  check(series[0].count === 2, 'the count is the number of grouped items');
  check(series[0].items.length === 2, 'and so is the length of the item list');
  check(standalone.length === 2, `a single item with an identifier stays standalone (${standalone.length})`);
  check(
    standalone.some((c) => c.title === 'Alleen'),
    'a collection of one is shown as a loose item, not as a series',
  );
  check(
    standalone.some((c) => c.title === 'Los'),
    'an item without any identifier is standalone',
  );
}

console.log('--- 2. Volgorde: de API-orde blijft staan, er wordt niets bij verzonnen ---');
{
  // Exactly the shape that caused the audit finding: a course whose titles say nothing about the order.
  const items = [
    record({ title: 'Les 3 — tafsir', collectionIdentifier: 'cursus', updatedAt: '2026-03-03T00:00:00.000Z' }),
    record({ title: 'Les 1 — tafsir', collectionIdentifier: 'cursus', updatedAt: '2026-03-01T00:00:00.000Z' }),
    record({ title: 'Les 2 — tafsir', collectionIdentifier: 'cursus', updatedAt: '2026-03-02T00:00:00.000Z' }),
  ];
  const before = items.map((c) => c.title);
  const { series } = groupByCollection(items);

  check(
    series[0].items.map((c) => c.title).join(' | ') === before.join(' | '),
    `the API order is preserved inside a series (${series[0].items.map((c) => c.title).join(' | ')})`,
  );
  check(
    series[0].items.map((c) => c.title).join(' | ') !== 'Les 1 — tafsir | Les 2 — tafsir | Les 3 — tafsir',
    'the items are not silently re-sorted alphabetically',
  );
  check
    (items.map((c) => c.title).join(' | ') === before.join(' | '),
    'the input list itself is not reordered either',
  );
  check(
    !series[0].items.some((c) => 'position' in c || 'episodeNumber' in c),
    'no position or episode number is invented for the items',
  );
}

console.log('--- 3. De lijst met series staat op naam, en houdt de titel van de collectie aan ---');
{
  const { series } = groupByCollection([
    record({ title: 'Z', collectionIdentifier: 'z-laatste', collectionTitle: 'Zebrasserie' }),
    record({ title: 'Z2', collectionIdentifier: 'z-laatste' }),
    record({ title: 'A', collectionIdentifier: 'a-eerste', series: 'Aardse reeks' }),
    record({ title: 'A2', collectionIdentifier: 'a-eerste' }),
    record({ title: 'M', collectionIdentifier: 'm-midden', collectionTitle: '  ' }),
    record({ title: 'M2', collectionIdentifier: 'm-midden' }),
  ]);

  check(
    series.map((s) => s.title).join(' | ') === 'Aardse reeks | m midden | Zebrasserie',
    `the series list is sorted by title (${series.map((s) => s.title).join(' | ')})`,
  );
  check(series[2].title === 'Zebrasserie', 'a collection title from the API wins');
  check(series[0].title === 'Aardse reeks', 'otherwise the item series name is used');
  check(series[1].title === 'm midden', 'and a missing title falls back to a readable identifier');
  check(!series.some((s) => /--/.test(s.title)), 'no raw double dashes end up in a title');
}

console.log('--- 4. Losse items onderling: nieuwste eerst ---');
{
  const { standalone } = groupByCollection([
    record({ title: 'Oud', updatedAt: '2025-01-01T00:00:00.000Z' }),
    record({ title: 'Nieuw', updatedAt: '2026-06-01T00:00:00.000Z' }),
    record({ title: 'Midden', updatedAt: '2026-01-01T00:00:00.000Z' }),
  ]);
  check(
    standalone.map((c) => c.title).join(' | ') === 'Nieuw | Midden | Oud',
    `standalone items run newest first (${standalone.map((c) => c.title).join(' | ')})`,
  );
}

console.log('--- 5. Een lege of onbruikbare identifier groepeert niet ---');
{
  const { series, standalone } = groupByCollection([
    record({ title: 'Spatie', collectionIdentifier: '   ' }),
    record({ title: 'Leeg', collectionIdentifier: '' }),
    record({ title: 'Eén teken', collectionIdentifier: 'x' }),
    record({ title: 'Null', collectionIdentifier: null }),
    record({ title: 'Ongedefinieerd', collectionIdentifier: undefined }),
  ]);
  check(series.length === 0, 'five unusable identifiers never form a series');
  check(standalone.length === 5, `all five stay standalone (${standalone.length})`);
  check(groupByCollection([]).series.length === 0, 'an empty library yields no series');
  check(groupByCollection([]).standalone.length === 0, 'and no standalone items');
}

console.log('--- 6. Wat een kaart toont komt echt uit de records ---');
{
  const { series } = groupByCollection([
    record({
      title: 'Eerste',
      collectionIdentifier: 'samen',
      provider: 'youtube',
      thumbnailUrl: null,
      coverUrl: 'https://example.invalid/cover.jpg',
      description: 'Een beschrijving van de eerste opname in deze reeks.',
      subjects: [subject('s1', 'Tafsir', 'green'), subject('s2', 'Quran')],
      scholars: [scholar('p1', 'Ibn Kathir')],
    }),
    record({
      title: 'Tweede',
      collectionIdentifier: 'samen',
      provider: 'youtube',
      subjects: [subject('s1', 'Tafsir', 'green'), subject('s3', 'Hadith')],
      scholars: [scholar('p1', 'Ibn Kathir'), scholar('p2', 'An-Nawawi')],
    }),
  ]);
  const g = series[0];

  check(g.type === 'playlist', `a YouTube collection is labelled a playlist (${g.type})`);
  check(g.provider === 'youtube', 'the provider comes from the records');
  check(g.subjects.length === 3, `subjects are the union without duplicates (${g.subjects.length})`);
  check(g.scholars.length === 2, `scholars are the union without duplicates (${g.scholars.length})`);
  check(g.subjects.some((s) => s.accent === 'green'), 'a subject keeps its accent from the API');
  check(g.thumbnailUrl === 'https://example.invalid/cover.jpg', 'the thumbnail falls back to the cover');
  check(g.coverUrl === 'https://example.invalid/cover.jpg', 'the cover falls back to the thumbnail as well');
  check((g.description || '').length > 0 && (g.description || '').length <= 160, 'the description is bounded');
  check(g.description.startsWith('Een beschrijving'), 'and it is a real description from the record');

  const archive = groupByCollection([
    record({ title: 'A', collectionIdentifier: 'archief', provider: 'archive' }),
    record({ title: 'B', collectionIdentifier: 'archief', provider: 'archive' }),
  ]).series[0];
  check(archive.type === 'collection', `an Archive.org collection is labelled a collection (${archive.type})`);

  const plain = groupByCollection([
    record({ title: 'A', collectionIdentifier: 'lokaal', provider: 'external' }),
    record({ title: 'B', collectionIdentifier: 'lokaal', provider: 'external' }),
  ]).series[0];
  check(plain.type === 'series', `anything else is a plain series (${plain.type})`);
}

console.log('--- 7. Download- en streamlinks: alleen echte bestanden, nooit een geraden URL ---');
{
  const youtube = record({ provider: 'youtube', externalIdentifier: 'abc123' });
  check(getDownloadUrl(youtube) === null, 'a YouTube item has no download link');
  check(getAudioStreamUrl(youtube) === null, 'and no direct stream link');

  const gbooks = record({ provider: 'google_books', sourceUrl: 'https://books.google.com/books?id=1' });
  check(getDownloadUrl(gbooks) === null, 'a Google Books item has no direct download');

  const pdf = record({ provider: 'pdf', sourceUrl: 'https://example.invalid/boek.pdf' });
  check(getDownloadUrl(pdf) === 'https://example.invalid/boek.pdf', 'a real PDF link is offered as download');
  const notPdf = record({ provider: 'pdf', sourceUrl: 'https://example.invalid/pagina' });
  check(getDownloadUrl(notPdf) === null, 'a PDF provider without a .pdf address yields nothing');

  const mp3 = record({ provider: 'external', sourceUrl: 'https://example.invalid/lezing.mp3' });
  check(getDownloadUrl(mp3) === 'https://example.invalid/lezing.mp3', 'a direct audio file link is offered');
  const page = record({ provider: 'external', sourceUrl: 'https://example.invalid/artikel' });
  check(getDownloadUrl(page) === null, 'a web page is not presented as a download');

  const fileLevel = record({
    provider: 'archive',
    type: 'audio',
    collectionIdentifier: 'collectie',
    externalIdentifier: 'collectie--map/Bestand Naam.mp3',
  });
  check(
    getDownloadUrl(fileLevel) === 'https://archive.org/download/collectie/map%2FBestand%20Naam.mp3.mp3',
    'a file-level Archive item gets a real download URL',
  );
  check(
    getAudioStreamUrl(fileLevel) === getDownloadUrl(fileLevel),
    'and the same URL is used for streaming',
  );

  const singleArchive = record({ provider: 'archive', type: 'book', externalIdentifier: 'enkel-item' });
  check(getDownloadUrl(singleArchive) === null, 'an Archive item without a known file name gets no guessed URL');
}

console.log(`\n${failed === 0 ? '✅' : '❌'} series: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
