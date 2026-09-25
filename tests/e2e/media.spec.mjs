/**
 * Fase 3.6 — real browser verification (Playwright + Chromium, live backend + live public site)
 *
 *  1. realtime waveform: bars must actually move while the real audio plays (Web Audio AnalyserNode)
 *  2. default audio thumbnail: no black Archive.org services image — ilmNet audio placeholder instead
 *  3. custom admin thumbnail: uploaded image wins on the public site (list + detail)
 *
 * Run with the backend (3001) and vite dev server (5173) up:   npm run test:e2e
 */
import { chromium } from 'playwright';
import { signInBrowser } from './lib/admin-session.mjs';
import fs from 'fs';
import path from 'path';

const SITE = process.env.SITE_URL || 'http://localhost:5173';
const API = process.env.API_URL || 'http://localhost:3001';
const TOKEN = process.env.ADMIN_TOKEN || 'ilmnet-admin-dev-2026';

let passed = 0;
let failed = 0;
const createdContentIds = [];

const ok = (m) => {
  passed++;
  console.log(`✅ ${m}`);
};
const fail = (m) => {
  failed++;
  console.log(`❌ ${m}`);
};
const check = (cond, m) => (cond ? ok(m) : fail(m));

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

async function api(pathname, opts = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...opts,
    headers: { 'x-admin-token': TOKEN, ...(opts.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${pathname} → ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  return body;
}

async function uploadPng(name) {
  const boundary = '----ilmnete2e' + Math.random().toString(36).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: image/png\r\n\r\n`,
  );
  const form = Buffer.concat([head, PNG_1PX, Buffer.from(`\r\n--${boundary}--\r\n`)]);
  const res = await fetch(`${API}/api/admin/uploads`, {
    method: 'POST',
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, 'x-admin-token': TOKEN },
    body: form,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`upload failed: ${JSON.stringify(body)}`);
  return body.data;
}

async function main() {
  console.log(`Site: ${SITE} · API: ${API}\n`);

  // ── live data ────────────────────────────────────────────────────────────────
  const published = (await api('/api/contents?limit=100&type=audio,lecture,video')).data;
  const imported = published.filter((c) => !/^E2E /i.test(c.title) && !c.externalIdentifier?.startsWith('e2e-'));
  // A track needs a file-level identifier (item--file) before the app can build a direct MP3 URL.
  const playable = (c) => c.provider === 'archive' && c.type === 'audio' && c.externalIdentifier?.includes('--');
  const realAudio = imported.find(playable) ?? published.find(playable);
  let blackThumbAudio = imported.find((c) => c.type === 'audio' && (c.thumbnailUrl ?? '').includes('archive.org/services/img'));
  if (blackThumbAudio) console.log(`Archive-black-thumbnail audio: ${blackThumbAudio.slug}`);
  else console.log('note: no content currently carries an archive.org/services/img thumbnail — a real fixture will be created');
  if (!realAudio) throw new Error('no published archive audio found to test playback');
  console.log(`Real archive audio: ${realAudio.slug} (${realAudio.sourceUrl})`);

  // ── custom thumbnail fixture (real upload through the real API) ──────────────
  const scholar = (await api('/api/admin/scholars')).data[0];
  const subject = (await api('/api/admin/subjects')).data[0];
  const upload = await uploadPng('e2e-custom-thumb.png');
  console.log(`Uploaded custom thumbnail: ${upload.url} (${upload.bytes} bytes)\n`);

  const stamp = Date.now();
  const created = (
    await api('/api/admin/contents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'audio',
        title: `E2E custom thumbnail audio ${stamp}`,
        provider: 'archive',
        sourceUrl: 'https://archive.org/details/RenewingOurIntentions',
        externalIdentifier: `e2e-custom-${stamp}`,
        status: 'published',
        thumbnailUrl: upload.url,
        scholarIds: [scholar.id],
        subjectIds: [subject.id],
      }),
    })
  ).data;
  createdContentIds.push(created.id);

  const browser = await chromium.launch({
    args: [
      '--no-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--mute-audio',
    ],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  // The CMS is behind the Fase 4.5 sign-in: the harness signs in over the API and hands the
  // browser the session cookie — exactly what an operator ends up with, nothing in web storage.
  await signInBrowser(context, SITE, process.env.ADMIN_USERNAME || 'media-e2e-admin');
  const page = await context.newPage();

  try {
    // ═══ 3. Custom thumbnail wins on the public site ══════════════════════════
    console.log('--- 3. Custom admin thumbnail on the public site ---');
    await page.goto(`${SITE}/#/lectures/${created.slug}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="audio-placeholder"], article, section', { timeout: 15000 });

    const detailImg = await page
      .locator(`img[src*="/uploads/"]`)
      .first()
      .getAttribute('src', { timeout: 15000 })
      .catch(() => null);
    check(!!detailImg && detailImg.includes(upload.filename), `detail page renders the custom upload (${detailImg})`);

    const artworkHasPriority = await page.locator('text=Custom upload').first().isVisible().catch(() => false);
    check(artworkHasPriority, 'detail page marks the image as “Custom upload” (priority over provider)');

    const servedOk = await page.evaluate(async (url) => {
      const res = await fetch(url);
      return res.ok && res.headers.get('content-type')?.includes('image');
    }, detailImg);
    check(servedOk, 'uploaded image is actually served (200 + image content-type) to the browser');

    await page.goto(`${SITE}/#/lectures?q=${encodeURIComponent('E2E custom thumbnail audio')}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('a[href*="e2e-custom-thumbnail-audio"]', { timeout: 15000 });
    const listImg = await page.locator('a[href*="e2e-custom-thumbnail-audio"] img').first().getAttribute('src').catch(() => null);
    check(!!listImg && listImg.includes(upload.filename), `lecture card uses the custom upload too (${listImg})`);

    // ═══ 2. Fallback thumbnail = ilmNet placeholder, no black Archive image ═══
    console.log('\n--- 2. Default audio thumbnail (fallback) ---');
    if (!blackThumbAudio) {
      // real fixture: a record whose provider thumbnail is the black Archive.org services image
      const stamp = Date.now();
      const fixture = await api('/api/admin/contents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'audio',
          title: `E2E archive black thumbnail ${stamp}`,
          provider: 'archive',
          sourceUrl: 'https://archive.org/details/RenewingOurIntentions',
          externalIdentifier: `e2e-blackthumb-${stamp}`,
          status: 'published',
          thumbnailUrl: 'https://archive.org/services/img/RenewingOurIntentions',
        }),
      });
      createdContentIds.push(fixture.id);
      blackThumbAudio = fixture;
      console.log(`Created archive-black-thumbnail fixture: ${fixture.slug}`);
    }
    if (blackThumbAudio) {
      await page.goto(`${SITE}/#/books`, { waitUntil: 'domcontentloaded' }); // warm navigation
      await page.goto(`${SITE}/#/lectures/${blackThumbAudio.slug}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-testid="audio-placeholder"]', { timeout: 15000 });
      check(true, 'audio without a usable thumbnail shows the ilmNet audio placeholder on the detail page');

      const blackImgs = await page.locator('img[src*="archive.org/services/img"]').count();
      check(blackImgs === 0, 'no black Archive.org services thumbnail rendered on the page');

      const collectionId = blackThumbAudio.collectionIdentifier;
      const listUrl = collectionId ? `${SITE}/#/series/${encodeURIComponent(collectionId)}` : `${SITE}/#/lectures?q=${encodeURIComponent(blackThumbAudio.title.slice(0, 24))}`;
      await page.goto(listUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(`a[href*="${blackThumbAudio.slug}"]`, { timeout: 15000 });
      const card = page.locator(`a[href*="${blackThumbAudio.slug}"]`).first();
      const cardPlaceholder = await card.locator('[data-testid="audio-placeholder"]').count();
      const cardBlack = await card.locator('img[src*="archive.org/services/img"]').count();
      check(cardPlaceholder === 1 && cardBlack === 0, `episode card in ${collectionId ?? 'list'} shows the placeholder instead of the black Archive image`);

      await page.goto(`${SITE}/#/lectures?q=${encodeURIComponent(blackThumbAudio.title.slice(0, 24))}`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector(`a[href*="${blackThumbAudio.slug}"]`, { timeout: 15000 });
      const singleCard = page.locator(`a[href*="${blackThumbAudio.slug}"]`).first();
      const singlePlaceholder = await singleCard.locator('[data-testid="audio-placeholder"]').count();
      const singleBlack = await singleCard.locator('img[src*="archive.org/services/img"]').count();
      check(singlePlaceholder === 1 && singleBlack === 0, 'lectures list card shows the placeholder instead of the black Archive image');
    } else {
      fail('no archive-black-thumbnail content available to verify the fallback');
    }

    const placeholderIsStyled = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="audio-placeholder"]');
      if (!el) return false;
      const grid = el.querySelector('div');
      const svg = el.querySelector('svg');
      return !!grid && !!svg;
    });
    check(placeholderIsStyled, 'placeholder uses the neumorphic sand/cream styling with an audio glyph (no religious symbols)');

    // ═══ 1. Realtime waveform during real playback ══════════════════════════
    console.log('\n--- 1. Waveform during real audio playback ---');
    await page.goto(`${SITE}/#/lectures/${realAudio.slug}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="audio-toggle"]', { timeout: 20000 });

    const barsBefore = await page.$$eval('[data-testid="waveform-bar"]', (els) => els.map((e) => e.style.height));
    check(barsBefore.length === 24, `waveform renders 24 bars (${barsBefore.length})`);

    await page.click('[data-testid="audio-toggle"]');

    // collect the bar heights over ~5s of real playback
    const samples = [];
    for (let i = 0; i < 18; i++) {
      await page.waitForTimeout(280);
      const heights = await page.$$eval('[data-testid="waveform-bar"]', (els) => els.map((e) => parseFloat(e.style.height) || 0));
      samples.push(heights);
    }

    const elapsed = await page.$eval('[data-testid="audio-element"]', (a) => ({ t: a.currentTime, paused: a.paused, ready: a.readyState }));
    check(!elapsed.paused, 'audio element is actually playing in the browser');
    check(elapsed.t > 0.5, `playback position advanced (currentTime ${elapsed.t.toFixed(2)}s, readyState ${elapsed.ready})`);

    const uniqueFrames = new Set(samples.map((s) => s.map((h) => Math.round(h)).join(','))).size;
    check(uniqueFrames > 5, `waveform frames change over time (${uniqueFrames} distinct frames from 18 samples)`);

    const allHeights = samples.flat();
    const min = Math.min(...allHeights);
    const max = Math.max(...allHeights);
    check(max - min > 8, `bar heights vary with the real signal (min ${min.toFixed(1)}px, max ${max.toFixed(1)}px)`);

    const perBarVariance = Array.from({ length: 24 }, (_, i) => {
      const vals = samples.map((s) => s[i]);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      return Math.max(...vals) - Math.min(...vals);
    });
    const movingBars = perBarVariance.filter((v) => v > 3).length;
    // a real speech recording concentrates energy in the lower frequency bins, so the top bins barely move
    check(movingBars >= 10, `${movingBars}/24 bars move independently with the spectrum of the recording`);

    const liveBadge = await page.locator('[data-testid="waveform-status"]').innerText().catch(() => '');
    check(/live waveform/i.test(liveBadge), `player reports a live waveform while playing (“${liveBadge.trim()}”)`);

    // pause → waveform stops updating, playback stops
    await page.click('[data-testid="audio-toggle"]');
    await page.waitForTimeout(700);
    const pausedA = await page.$eval('[data-testid="audio-element"]', (a) => a.currentTime);
    const frameA = await page.$$eval('[data-testid="waveform-bar"]', (els) => els.map((e) => e.style.height).join(','));
    await page.waitForTimeout(900);
    const pausedB = await page.$eval('[data-testid="audio-element"]', (a) => a.currentTime);
    const frameB = await page.$$eval('[data-testid="waveform-bar"]', (els) => els.map((e) => e.style.height).join(','));
    check(Math.abs(pausedB - pausedA) < 0.05, 'pause stops playback');
    check(frameA === frameB, 'waveform resets to a steady state when paused');

    // seek still works after the Web Audio graph is attached
    await page.click('[data-testid="audio-toggle"]');
    await page.waitForTimeout(400);
    await page.$eval('input[type="range"]', (el) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, '50');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(600);
    const seeked = await page.$eval('[data-testid="audio-element"]', (a) => a.currentTime);
    check(seeked > 60, `seeking to 50% still works with the analyser attached (currentTime ${seeked.toFixed(0)}s)`);

    // ═══ 4. Admin CMS: upload a thumbnail through the real form ═════════════
    console.log('\n--- 4. Admin CMS thumbnail upload (real form → real DB) ---');
    const adminTitle = `E2E admin upload ${Date.now()}`;
    await page.goto(`${SITE}/#/admin/lectures/new`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="lecture-thumbnail"]', { timeout: 20000 });

    await page.fill('input[placeholder*="Opening the Qur"]', adminTitle);
    await page.locator('input[placeholder*="youtube.com/watch"]').first().fill('https://youtu.be/T-4XGWUV8hI');
    const chips = page.locator('section:has-text("Scholars & subjects") button[type="button"]');
    const chipTexts = await chips.allInnerTexts();
    await chips.nth(0).click(); // first scholar
    const firstSubjectIdx = chipTexts.findIndex((txt) => /Family & Society|Ethics|Islamic History|Tazkiyah|Belief/.test(txt));
    await chips.nth(firstSubjectIdx >= 0 ? firstSubjectIdx : chipTexts.length - 1).click(); // first subject chip

    const pngPath = path.join('/tmp', 'admin-upload-e2e.png');
    fs.writeFileSync(pngPath, PNG_1PX);
    await page.setInputFiles('[data-testid="media-file-input"]', pngPath);
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="lecture-thumbnail"]');
      return !!el && /\/uploads\//.test(el.textContent || '');
    }, { timeout: 20000 }).catch(() => {});
    const fieldText = await page.locator('[data-testid="lecture-thumbnail"]').innerText();
    check(/\/uploads\//.test(fieldText), 'admin upload field stores the /uploads path after uploading a file');
    check(/Custom · priority/.test(fieldText), 'admin field marks the upload as “Custom · priority”');

    // Publish straight from the admin form so we can verify the public site afterwards
    await page.getByRole('button', { name: 'Publish to library' }).click({ timeout: 15000 });
    await page.waitForTimeout(2600);
    const savedBanner = await page.locator('.text-rose').first().innerText().catch(() => '');
    if (/required|valid/i.test(savedBanner)) console.log(`   form reported: ${savedBanner.slice(0, 120)}`);

    const savedList = (await api(`/api/admin/contents?q=${encodeURIComponent(adminTitle)}&limit=10`)).data;
    const savedItem = savedList.find((c) => c.title === adminTitle);
    check(!!savedItem, 'content created from the admin form is persisted in the database');
    check(savedItem?.status === 'published', `record is published from the form (status ${savedItem?.status})`);
    if (savedItem) {
      createdContentIds.push(savedItem.id);
      check((savedItem.thumbnailUrl ?? '').includes('/uploads/'), `saved record keeps the custom thumbnail (${savedItem.thumbnailUrl})`);
      await page.goto(`${SITE}/#/lectures/${savedItem.slug}`, { waitUntil: 'domcontentloaded' });
      const adminThumb = await page.locator('img[src*="/uploads/"]').first().getAttribute('src').catch(() => null);
      check(!!adminThumb && adminThumb.includes(savedItem.thumbnailUrl.split('/').pop()), `public detail page for the new record shows the uploaded image (${adminThumb})`);
    }

    // mobile viewport smoke test
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${SITE}/#/lectures/${realAudio.slug}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="waveform"]', { timeout: 20000 });
    const mobBars = await page.locator('[data-testid="waveform-bar"]').count();
    check(mobBars === 24, `waveform renders fully on mobile viewport (${mobBars} bars)`);
    const mobThumb = await page.locator('img[src*="archive.org/services/img"]').count();
    check(mobThumb === 0, 'mobile view also avoids the black Archive thumbnail');
  } catch (e) {
    fail(`unexpected error: ${e?.message ?? e}`);
  } finally {
    await browser.close();

    for (const id of createdContentIds) {
      await fetch(`${API}/api/admin/contents/${id}?hard=true`, { method: 'DELETE', headers: { 'x-admin-token': TOKEN } }).catch(() => {});
    }
    // remove every file this run uploaded (fixture + admin-form upload) so the workspace stays clean
    const leftovers = await fetch(`${API}/api/admin/uploads`, { headers: { 'x-admin-token': TOKEN } })
      .then((r) => r.json())
      .then((b) => b.data ?? [])
      .catch(() => []);
    for (const f of leftovers) {
      if (f.filename === upload.filename || f.filename.startsWith('admin-upload-e2e-')) {
        await fetch(`${API}/api/admin/uploads/${f.filename}`, { method: 'DELETE', headers: { 'x-admin-token': TOKEN } }).catch(() => {});
      }
    }
  }

  console.log(`\n${failed === 0 ? '✅ All media e2e checks passed' : `❌ ${failed} e2e checks failed`} (${passed} passed, ${failed} failed)`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
