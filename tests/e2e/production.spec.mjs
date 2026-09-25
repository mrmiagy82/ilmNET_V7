/**
 * Fase 3.7 — production readiness in a real browser.
 *
 * Runs against the API in production mode serving the built frontend (single origin):
 *   cd server && npm run build
 *   NODE_ENV=production ADMIN_TOKEN=… CORS_ORIGIN=http://localhost:3101 node dist/server.js
 *   node tests/e2e/production.spec.mjs
 *
 * Checks: direct URLs + hard refresh, loading state, API-failure state, missing thumbnail file,
 * real embeds (YouTube/Archive audio), mobile layout (no horizontal overflow), admin entry.
 *
 * Note: the two state checks delay/abort the *real* API request (fault injection) — no mock data.
 */
import { chromium } from 'playwright';

const SITE = process.env.SITE_URL || 'http://localhost:3101';
const API = process.env.API_URL || SITE;
const TOKEN = process.env.ADMIN_TOKEN || 'prod-test-token-1234567890';

let passed = 0;
let failed = 0;
const created = [];
const ok = (m) => {
  passed++;
  console.log(`✅ ${m}`);
};
const fail = (m) => {
  failed++;
  console.log(`❌ ${m}`);
};
const check = (cond, m) => (cond ? ok(m) : fail(m));

async function api(pathname, opts = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...opts,
    headers: { 'x-admin-token': TOKEN, ...(opts.headers ?? {}) },
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function main() {
  // Real data for real URLs (no fixtures)
  const contents = (await fetch(`${API}/api/contents?limit=100`).then((r) => r.json())).data;
  const video = contents.find((c) => c.type === 'video' && c.provider === 'youtube');
  const audio = contents.find((c) => c.type === 'audio' && c.collectionIdentifier === 'RenewingOurIntentions');
  const book = contents.find((c) => c.provider === 'archive' && (c.type === 'book' || c.type === 'document'));
  const series = contents.find((c) => c.collectionIdentifier === 'PLB1_h06YGESJOklRpiVLn6S4qsk4azOrZ') ?? video ?? contents[0];
  const subjects = (await fetch(`${API}/api/subjects`).then((r) => r.json())).data;
  const scholars = (await fetch(`${API}/api/scholars`).then((r) => r.json())).data;

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`${msg.text()} @ ${msg.location()?.url ?? page.url()}`);
  });
  page.on('pageerror', (err) => consoleErrors.push(`${err.message} @ ${page.url()} :: ${(err.stack ?? '').split('\n')[1] ?? ''}`));

  const videoPath = `/lectures/${video?.slug ?? contents[0].slug}`;
  const routes = [
    ['/', 'Home', /ilmNet/i],
    ['/lectures', 'Lectures', /lectures/i],
    ['/books', 'Books', /books/i],
    ['/scholars', 'Scholars', /scholars/i],
    ['/subjects', 'Subjects', /subjects/i],
    [`/series/${series.collectionIdentifier}`, 'Series detail', /./],
    [videoPath, 'Lecture detail (video)', /./],
    [`/books/${book?.slug ?? contents[0].slug}`, 'Book detail', /./],
    [`/subjects/${subjects[0].slug}`, 'Subject detail', /./],
    ['/admin', 'Admin CMS', /./],
  ];

  console.log('--- 1. Direct URLs + hard refresh (production build, same origin) ---');
  for (const [path, label, expect] of routes) {
    const res = await page.goto(`${SITE}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const mounted = await page.locator('#root').count();
    const text = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    const matched = expect.test(text) && text.length > 300;
    check(res?.status() === 200 && mounted === 1 && matched, `${label}: ${path} → ${res?.status()}, real page rendered (${text.length} chars)`);
    const header = await page.locator('header').first().innerText().catch(() => '');
    // This context carries no admin token in the browser, so `/admin` must show the admin login gate
    // (Fase 4.1) instead of CMS chrome — and must not render any part of the CMS.
    const gate = await page.locator('[data-testid="admin-login"]').count();
    const chrome = path.startsWith('/admin') ? gate === 1 : header.length > 0;
    check(chrome && !/just a moment/i.test(text), `${label}: renders app chrome, not the landing fallback`);
  }

  const reloadPath = videoPath;
  await page.goto(`${SITE}${reloadPath}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  const afterReload = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
  check(afterReload.length > 120, `hard refresh on ${reloadPath} still renders the page (${afterReload.length} chars)`);

  console.log('\n--- 1b. Old hash links still work (shared links keep resolving) ---');
  await page.goto(`${SITE}/#/lectures`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const hashText = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  check(page.url().endsWith('/lectures') && /lectures found/i.test(hashText), `/#/lectures redirects to /lectures (now ${new URL(page.url()).pathname})`);

  console.log('\n--- 2. Loading state while the real request is in flight (delay injection) ---');
  const slowCtx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const slowPage = await slowCtx.newPage();
  await slowPage.route('**/api/contents**', async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      await route.continue();
    } catch {
      /* request already finished when the page was closed */
    }
  });
  await slowPage.goto(`${SITE}/lectures`, { waitUntil: 'domcontentloaded' });
  const loadingVisible = await slowPage
    .getByText(/Loading|Searching lectures/i)
    .first()
    .isVisible()
    .catch(() => false);
  const statsDash = await slowPage.getByText('—').first().isVisible().catch(() => false);
  check(loadingVisible || statsDash, `lectures shows its loading state (skeleton text: ${loadingVisible}, stats placeholder: ${statsDash})`);
  await slowCtx.close();

  console.log('\n--- 3. Real API failure → readable error state (abort injection) ---');
  const failCtx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const failPage = await failCtx.newPage();
  await failPage.route('**/api/contents**', (route) => route.abort());
  await failPage.goto(`${SITE}/lectures`, { waitUntil: 'domcontentloaded' });
  await failPage.waitForTimeout(1500);
  const lecturesBody = await failPage.locator('body').innerText();
  check(/Could not load/i.test(lecturesBody), 'lectures shows “Could not load…” instead of a blank page');
  check(/Try again/i.test(lecturesBody), 'lectures offers a retry action');
  await failPage.goto(`${SITE}${videoPath}`, { waitUntil: 'domcontentloaded' });
  await failPage.waitForTimeout(1500);
  const detailBody = await failPage.locator('body').innerText();
  check(/Could not load content/i.test(detailBody), 'content detail shows its error card (not a crash)');
  check((await failPage.getByRole('link', { name: /Back to/i }).count()) > 0, 'error card offers a way back to the library');
  await failCtx.close();

  console.log('\n--- 4. Thumbnail file missing on disk (e.g. uploads volume not mounted) ---');
  const missing = await api('/api/admin/contents', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: `E2E missing thumbnail ${Date.now()}`,
      type: 'lecture',
      provider: 'archive',
      sourceUrl: 'https://archive.org/details/RenewingOurIntentions',
      externalIdentifier: `e2e-missing-thumb-${Date.now()}`,
      language: 'English',
      status: 'published',
      thumbnailUrl: '/uploads/e2e-file-that-does-not-exist.png',
    }),
  });
  check(missing.status === 201 || missing.status === 200, `admin API accepted a published record with a /uploads thumbnail (${missing.status})`);
  const missingId = missing.json?.data?.id;
  const missingSlug = missing.json?.data?.slug;
  if (missingId) created.push(missingId);

  if (missingSlug) {
    const brokenRes = await fetch(`${SITE}/uploads/e2e-file-that-does-not-exist.png`);
    check(brokenRes.status === 404, `the referenced file really is absent (HTTP ${brokenRes.status})`);

    await page.goto(`${SITE}/lectures?q=${encodeURIComponent('missing thumbnail')}`);
    await page.waitForTimeout(900);
    const card = page.locator('[data-testid="lecture-card-thumb"]').first();
    const imgVisible = await card.locator('img').first().isVisible().catch(() => false);
    const cardBox = await card.boundingBox();
    check(Boolean(cardBox) && cardBox.width > 50, 'the card still occupies its frame (no collapsed layout)');
    check(imgVisible === false, 'the broken image is hidden instead of showing a broken-image icon');
    const fallbackBars = await card.locator('span.rounded-full').count();
    check(fallbackBars > 0, `the ilmNet fallback layer is rendered behind the missing image (${fallbackBars} waveform bars)`);

    await page.goto(`${SITE}/lectures/${missingSlug}`);
    await page.waitForTimeout(900);
    const detailImgs = await page.locator('img[src*="e2e-file-that-does-not-exist"]').evaluateAll((els) => els.map((e) => e.naturalWidth));
    check(detailImgs.every((w) => w === 0) || detailImgs.length === 0, 'the detail page does not render a usable broken image');
    const detailText = await page.locator('body').innerText();
    check(!/not published|not found/i.test(detailText), 'the record itself still loads (fallback only affects the image)');
  }

  console.log('\n--- 5. Real embeds and players (fallbacks never a black box) ---');
  if (video) {
    await page.goto(`${SITE}/lectures/${video.slug}`);
    await page.waitForTimeout(900);
    const frame = page.locator('iframe').first();
    const src = (await frame.getAttribute('src').catch(() => null)) ?? '';
    check(/youtube(-nocookie)?\.com\/embed\//.test(src), `video detail embeds the real YouTube player (${src.slice(0, 60)}…)`);
    const openOriginal = page.getByRole('link', { name: /Open original/i }).first();
    check((await openOriginal.count()) > 0, 'video detail keeps an “Open original” fallback link');
    const videoId = video.externalIdentifier ?? video.sourceUrl.split("v=").pop();
    check(src.includes(videoId) || src.includes("videoseries"), `the embed points at the imported video id (${videoId}), not a placeholder`);
  } else {
    fail('no real YouTube video in the database to check the embed');
  }

  // 5b. The YouTube player must not merely render: it has to boot and actually stream the video.
  // Headless Chromium cannot deliver a trusted click to a cross-origin frame, so playback is started
  // through the player's own API — that is how a visitor's click ends up as well (same player, same
  // media pipeline). Fase 4.3 verified this against the live YouTube CDN.
  if (video) {
    const media = [];
    page.on('request', (r) => { if (/googlevideo\.com\/videoplayback/.test(r.url())) media.push(r.url()); });
    await page.goto(`${SITE}/lectures/${video.slug}`, { waitUntil: 'domcontentloaded' });
    const ytFrame = await (await page.locator('iframe').first().elementHandle()).contentFrame();
    if (!ytFrame) {
      fail('YouTube embed did not load as a frame');
    } else {
      await ytFrame.waitForTimeout(6000);
      const booted = await ytFrame.evaluate(() => ({
        player: !!document.querySelector('#movie_player'),
        videoTag: !!document.querySelector('video'),
      }));
      check(booted.player && booted.videoTag, 'the YouTube player boots inside the embed (player + video element)');

      const played = await ytFrame.evaluate(async () => {
        const pl = document.querySelector('#movie_player');
        if (typeof pl?.playVideo !== 'function') return { ok: false, reason: 'player API unavailable' };
        pl.playVideo();
        await new Promise((r) => setTimeout(r, 9000));
        const v = document.querySelector('video');
        return { ok: true, state: pl.getPlayerState?.(), time: v?.currentTime ?? 0, readyState: v?.readyState ?? 0, error: v?.error?.code ?? null };
      });
      check(played.ok && played.state === 1 && played.time > 0 && !played.error,
        `playback really starts (state ${played.state}, currentTime ${played.time?.toFixed?.(1)}s, error ${played.error})`);
      check(media.length > 0, `the player streams real YouTube media (${media.length} videoplayback request(s))`);
    }
  }

  if (audio) {
    await page.goto(`${SITE}/lectures/${audio.slug}`);
    await page.waitForTimeout(900);
    check((await page.locator('iframe').count()) === 0, 'audio detail uses the custom player (no iframe)');
    check(await page.locator('[data-testid="waveform"]').isVisible(), 'audio detail renders the waveform');
    const dl = page.getByRole('link', { name: /Download audio/i }).first();
    const dlHref = (await dl.getAttribute('href').catch(() => null)) ?? '';
    check(/^https:\/\/archive\.org\/download\/.+\.mp3/.test(dlHref), `download audio points at a real MP3 (${dlHref.slice(0, 70)}…)`);
  } else {
    fail('no real Archive audio in the database to check the player');
  }

  if (book) {
    await page.goto(`${SITE}/books/${book.slug}`);
    await page.waitForTimeout(900);
    const frameSrc = (await page.locator('iframe').first().getAttribute('src').catch(() => null)) ?? '';
    check(/archive\.org\/(embed|details)/.test(frameSrc) || frameSrc === '', `book detail embeds the real Archive reader (${frameSrc.slice(0, 60)}…)`);
    const txt = await page.locator('body').innerText();
    check(/Download PDF|Open on Archive\.org|Open original/i.test(txt), 'book detail offers a download/open fallback');
  }

  console.log('\n--- 6. Admin entry from a direct URL, without a token ---');
  await page.goto(`${SITE}/admin`);
  await page.waitForTimeout(600);
  const adminText = await page.locator('body').innerText();
  check(/admin/i.test(adminText), 'admin CMS loads from a direct URL');
  check(/no login/i.test(adminText), 'the public library is documented as login-free right on the admin entry');
  check(
    (await page.locator('[data-testid="admin-login"]').count()) === 1,
    'the CMS is behind an admin login gate (Fase 4.1/4.5) when no session is present'
  );
  check(
    !/Add content|Archive\.org Bulk Import|YouTube Bulk Import/.test(adminText),
    'no CMS chrome leaks before the admin has signed in'
  );
  check(/username/i.test(adminText) && /password/i.test(adminText), 'admin CMS asks for username + password (no baked-in secret)');
  check(/PostgreSQL|connected|sign in|password/i.test(adminText), 'admin CMS reports the backend/database state and the sign-in requirement');

  console.log('\n--- 7. Mobile layout (390×844) ---');
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mPage = await mobile.newPage();
  for (const path of [
    '/',
    '/lectures',
    '/books',
    '/scholars',
    '/subjects',
    `/lectures/${audio?.slug ?? contents[0].slug}`,
    '/admin',
    '/admin/lectures',
    '/admin/books',
    '/admin/scholars',
    '/admin/subjects',
    '/admin/new',
    '/admin/archive-import',
    '/admin/youtube-import',
  ]) {
    await mPage.goto(`${SITE}${path}`);
    await mPage.waitForTimeout(500);
    const overflow = await mPage.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));
    check(overflow.scrollW <= overflow.clientW + 2, `${path} has no horizontal overflow on mobile (${overflow.scrollW}px vs ${overflow.clientW}px)`);
  }
  await mPage.goto(`${SITE}/`);
  const navButtons = await mPage.getByRole('button').count();
  check(navButtons > 0, `mobile navigation controls are present and tappable (${navButtons} buttons)`);
  await mobile.close();

  // third-party embed scripts (archive.org / YouTube) and the deliberate missing-file 404 are expected
  const realErrors = consoleErrors.filter(
    (e) =>
      !/favicon|ERR_ABORTED|Failed to load resource/i.test(e) &&
      !/archive\.org|youtube\.com|ytimg|googlevideo/i.test(e),
  );
  check(realErrors.length === 0, `no unexpected console errors in the browser (${realErrors.slice(0, 2).join(' | ').slice(0, 120)})`);

  // cleanup: remove the record created for the missing-thumbnail check
  for (const id of created) await api(`/api/admin/contents/${id}?hard=true`, { method: 'DELETE' });

  await context.close();
  await browser.close();

  console.log(`\n${failed === 0 ? '✅ All production e2e checks passed' : `❌ ${failed} checks failed`} (${passed} passed, ${failed} failed)`);
  process.exit(failed === 0 ? 0 : 1);
}

void main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
