/**
 * Fase 4 — the admin CMS in a real browser, against the real API and PostgreSQL.
 *
 *   cd server && npm run build
 *   NODE_ENV=production ADMIN_TOKEN=… CORS_ORIGIN=http://localhost:3101 node dist/server.js
 *   ADMIN_TOKEN=… node tests/e2e/cms.spec.mjs
 *
 * What it proves (no mocks anywhere):
 *   1. the dashboard shows the real database totals, not a capped list or a stand-in 0;
 *   2. draft → published → archived → restored are all reachable from the admin and land in the DB;
 *   3. an archived record disappears from the public API (and comes back after publishing);
 *   4. editing a bulk-imported record keeps its series / collection grouping;
 *   5. a rejected token is reported as an authentication problem (401), not as an empty library.
 *
 * The fixture this suite creates is deleted again at the end (hard delete).
 */
import { chromium } from 'playwright';

const SITE = process.env.SITE_URL || 'http://localhost:3101';
const API = process.env.API_URL || SITE;
const TOKEN = process.env.ADMIN_TOKEN || 'prod-test-token-1234567890';
const COLLECTION_ID = 'e2e-admin-cms-collection';
const COLLECTION_TITLE = 'E2E admin CMS collection';

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
    // Fastify rejects a JSON content-type on a body-less request, so only set it when there is a body
    headers: { 'x-admin-token': TOKEN, ...(opts.body ? { 'content-type': 'application/json' } : {}), ...(opts.headers ?? {}) },
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const publicApi = async (pathname) => {
  const res = await fetch(`${API}${pathname}`);
  return res.status;
};

async function main() {
  const stamp = Date.now();
  const title = `E2E admin CMS ${stamp}`;
  const scholars = (await api('/api/admin/scholars')).json.data;
  const subjects = (await api('/api/admin/subjects')).json.data;
  check(scholars.length > 0 && subjects.length > 0, 'reference data present: scholars + subjects in the database');

  // ── Fixture: a published archive audio record that looks exactly like a bulk import ──────────
  const fixture = await api('/api/admin/contents', {
    method: 'POST',
    body: JSON.stringify({
      type: 'audio',
      title,
      description: 'Fixture created by tests/e2e/cms.spec.mjs — deleted at the end of the run.',
      status: 'published',
      language: 'English',
      series: 'E2E Series',
      provider: 'archive',
      sourceUrl: 'https://archive.org/details/RenewingOurIntentions',
      externalIdentifier: `e2e-admin-cms-${stamp}`,
      collectionIdentifier: COLLECTION_ID,
      collectionTitle: COLLECTION_TITLE,
      scholarIds: [scholars[0].id],
      subjectIds: [subjects[0].id],
    }),
  });
  const item = fixture.json?.data;
  created.push(item?.id);
  check(fixture.status === 201 && Boolean(item?.id), `fixture created through the admin API (${fixture.status})`);
  check(
    item?.collectionIdentifier === COLLECTION_ID && item?.collectionTitle === COLLECTION_TITLE,
    'fixture stores its collectionIdentifier + collectionTitle (bulk-import shape)'
  );

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  // Same as the operator: the token is pasted in the admin UI and lives in sessionStorage only.
  await context.addInitScript((token) => {
    try {
      window.sessionStorage.setItem('ilmnet.adminToken', token);
    } catch {
      /* ignore */
    }
  }, TOKEN);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`${msg.text()} @ ${msg.location()?.url ?? page.url()}`);
  });
  page.on('pageerror', (err) => consoleErrors.push(`${err.message} @ ${page.url()}`));

  // ── 1. Dashboard: real totals ────────────────────────────────────────────────────────────────
  const publishedTotal = (await api('/api/admin/contents?limit=1&status=published')).json.pagination.total;
  const archivedTotal = (await api('/api/admin/contents?limit=1&status=archived')).json.pagination.total;
  await page.goto(`${SITE}/admin`, { waitUntil: 'networkidle' });
  const dash = await page.locator('body').innerText();
  check(/Connected to the PostgreSQL library/i.test(dash), 'admin reports the real backend state (connected)');

  const publishedTile = await page.locator('a', { hasText: 'Published' }).first().innerText();
  const publishedShown = Number((publishedTile.match(/(\d+)/) ?? [])[1]);
  check(
    publishedShown === publishedTotal,
    `dashboard published tile is the database total (${publishedShown} shown, ${publishedTotal} via pagination.total)`
  );
  const archivedTile = await page.locator('a', { hasText: 'Archived' }).first().innerText();
  const archivedShown = Number((archivedTile.match(/(\d+)/) ?? [])[1]);
  check(
    archivedShown === archivedTotal,
    `dashboard archived tile is the database total (${archivedShown} shown, ${archivedTotal} via pagination.total)`
  );
  check(!/NaN|undefined/.test(dash), 'no broken placeholders in the dashboard copy');

  // ── 2. Content list: search, filters, states ────────────────────────────────────────────────
  await page.goto(`${SITE}/admin/lectures`, { waitUntil: 'networkidle' });
  const row = page.locator('tr', { hasText: title });
  check(await row.count() === 1, 'the record appears in the lectures list (real database row)');

  await page.fill('input[placeholder*="Search"]', title);
  check(await page.locator('tr', { hasText: title }).count() === 1, 'search narrows the list to the real record');
  await page.fill('input[placeholder*="Search"]', 'zzz-no-such-record-zzz');
  const emptyText = await page.locator('body').innerText();
  check(/No lectures match/i.test(emptyText), 'empty state is shown when nothing matches (not a silent blank list)');
  await page.fill('input[placeholder*="Search"]', '');
  check(
    await page.locator('button', { hasText: 'Archived' }).count() >= 1,
    'the status filter offers Archived (draft / published / archived)'
  );

  // ── 3. Archive from the list → hidden from the public API ───────────────────────────────────
  const liveRow = page.locator('tr', { hasText: title });
  await liveRow.getByRole('button', { name: 'Archive', exact: true }).click();
  await page.waitForTimeout(1200);
  const afterArchive = (await api(`/api/admin/contents/${item.id}`)).json.data;
  check(afterArchive.status === 'archived', `archiving from the list writes status=archived to PostgreSQL (${afterArchive.status})`);
  check((await publicApi(`/api/contents/${item.slug}`)) === 404, 'archived record is no longer public (public API 404)');
  const archiveToast = await page.locator('body').innerText();
  check(/archived — kept in the database, hidden from the public site/i.test(archiveToast), 'archive action reports what really happened');

  // ── 4. Archived filter + restore ────────────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Archived', exact: true }).first().click();
  await page.waitForTimeout(600);
  const archivedRow = page.locator('tr', { hasText: title });
  check(await archivedRow.count() === 1, 'the archived record is still findable in the admin (Archived filter)');
  check(/Archived/i.test(await archivedRow.innerText()), 'the archived row is labelled Archived');
  await archivedRow.getByRole('button', { name: 'Restore to draft' }).click();
  await page.waitForTimeout(1200);
  const afterRestore = (await api(`/api/admin/contents/${item.id}`)).json.data;
  check(afterRestore.status === 'draft', `restore puts the record back to draft, not online (${afterRestore.status})`);

  // ── 5. Publish from the list → public again ─────────────────────────────────────────────────
  await page.getByRole('button', { name: 'All states', exact: true }).click();
  await page.waitForTimeout(400);
  const draftRow = page.locator('tr', { hasText: title });
  await draftRow.getByRole('button', { name: 'Publish', exact: true }).click();
  await page.waitForTimeout(1200);
  const afterPublish = (await api(`/api/admin/contents/${item.id}`)).json.data;
  check(afterPublish.status === 'published', `publishing from the list writes status=published (${afterPublish.status})`);
  check((await publicApi(`/api/contents/${item.slug}`)) === 200, 'published record is public again');

  // ── 6. Detail/edit keeps the collection grouping (the bug this phase fixed) ─────────────────
  await page.goto(`${SITE}/admin/lectures/${item.id}`, { waitUntil: 'networkidle' });
  const formText = await page.locator('body').innerText();
  check(formText.includes(COLLECTION_TITLE) && formText.includes(COLLECTION_ID), 'the edit form shows the collection the record belongs to');
  check(/Published/i.test(formText), 'the edit form shows the current status');
  await page.getByRole('button', { name: 'Save as draft' }).click();
  await page.waitForTimeout(1500);
  const afterEdit = (await api(`/api/admin/contents/${item.id}`)).json.data;
  check(
    afterEdit.collectionIdentifier === COLLECTION_ID && afterEdit.collectionTitle === COLLECTION_TITLE,
    'saving an edit keeps collectionIdentifier + collectionTitle (no silent data loss)'
  );
  check(afterEdit.series === 'E2E Series', `saving an edit keeps the series field (${afterEdit.series})`);

  // ── 7. A rejected token is an auth problem, never an empty library ──────────────────────────
  const badContext = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await badContext.addInitScript(() => {
    try {
      window.sessionStorage.setItem('ilmnet.adminToken', 'definitely-not-the-token');
    } catch {
      /* ignore */
    }
  });
  const badPage = await badContext.newPage();
  await badPage.goto(`${SITE}/admin`, { waitUntil: 'networkidle' });
  const badText = await badPage.locator('body').innerText();
  check(/401|rejected|token/i.test(badText), 'a rejected token is reported as a 401/token problem');
  check(/not be shown|Not available|token/i.test(badText) && !/0 published/i.test(badText), 'no fake zeros are shown while the admin cannot read the database');
  await badContext.close();

  // The Archive.org embed loads its own bundle inside the preview iframe; its internals are not ours
  // (verified: the error only appears on pages that render that embed, never on YouTube-only pages).
  const thirdParty = /Cannot read properties of null \(reading 'categories'\)/;
  const realErrors = consoleErrors.filter(
    (e) =>
      !/favicon|ERR_ABORTED|Failed to load resource/i.test(e) &&
      !/archive\.org|youtube\.com|ytimg|googlevideo/i.test(e) &&
      !thirdParty.test(e)
  );
  check(realErrors.length === 0, `no unexpected console errors in the admin (${realErrors.slice(0, 2).join(' | ').slice(0, 120)})`);

  await context.close();
  await browser.close();

  // ── Cleanup ─────────────────────────────────────────────────────────────────────────────────
  for (const id of created.filter(Boolean)) {
    const del = await api(`/api/admin/contents/${id}?hard=true`, { method: 'DELETE' });
    check(del.status === 200, 'fixture removed again (hard delete through the admin API)');
  }
  const leftover = (await api(`/api/admin/contents?limit=1&q=${encodeURIComponent(title)}`)).json.pagination.total;
  check(leftover === 0, 'no fixture left behind in the database');

  console.log(`\n${failed === 0 ? '✅ All admin-CMS e2e checks passed' : `❌ ${failed} checks failed`} (${passed} passed, ${failed} failed)`);
  process.exit(failed === 0 ? 0 : 1);
}

void main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
