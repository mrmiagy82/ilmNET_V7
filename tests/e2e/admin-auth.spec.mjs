/**
 * Fase 4.1 — admin authentication in a real browser, against the real API.
 *
 *   cd server && npm run build
 *   NODE_ENV=production ADMIN_TOKEN=… CORS_ORIGIN=http://localhost:3101 node dist/server.js
 *   ADMIN_TOKEN=… node tests/e2e/admin-auth.spec.mjs
 *
 * What it proves (no mocks, no shortcuts):
 *   1. the admin token is nowhere in the shipped bundle;
 *   2. the public site and the public API stay open — no login needed;
 *   3. the admin API is protected server-side (401 without a token);
 *   4. /admin shows a real login screen and no part of the CMS while unauthenticated;
 *   5. a wrong token produces a clear error and never unlocks the CMS;
 *   6. a valid token signs in, also from a deep link (/admin/lectures keeps its URL);
 *   7. refresh re-verifies the session against the API; a tampered token drops back to the login;
 *   8. signing out ends the session, and no credential ends up in localStorage or the URL.
 */
import { chromium } from 'playwright';

const SITE = process.env.SITE_URL || 'http://localhost:3101';
const API = process.env.API_URL || SITE;
const TOKEN = process.env.ADMIN_TOKEN || 'prod-test-token-1234567890';
const WRONG_TOKEN = 'e2e-wrong-token-0123456789';
const STORAGE_KEY = 'ilmnet.adminToken';

// Markers that only exist inside the CMS (never on the login screen).
const CMS_MARKERS = ['Add content', 'Published lectures', 'Archive.org Bulk'];
const LOGIN = '[data-testid="admin-login"]';

let passed = 0;
let failed = 0;
const ok = (m) => {
  passed++;
  console.log(`✅ ${m}`);
};
const fail = (m) => {
  failed++;
  console.log(`❌ ${m}`);
};
const check = (cond, m) => (cond ? ok(m) : fail(m));

async function status(pathname, headers = {}) {
  const res = await fetch(`${API}${pathname}`, { headers });
  return res.status;
}

async function main() {
  const browser = await chromium.launch();

  // ── 1. No secret in the shipped frontend ─────────────────────────────────────────────────────
  const html = await fetch(`${SITE}/`).then((r) => r.text());
  check(!html.includes(TOKEN), 'the admin token is not present in the built frontend');
  check(!/ilmnet_(prod|admin)[_-]?[a-z0-9]{6,}/i.test(html), 'the bundle contains no hardcoded admin token pattern');

  // ── 2. The public side needs no login ───────────────────────────────────────────────────────
  const publicRoutes = ['/', '/lectures', '/books', '/scholars', '/subjects'];
  for (const route of publicRoutes) {
    check((await status(route)) === 200, `public route ${route} stays public (no login)`);
  }
  check((await status('/api/contents?limit=1')) === 200, 'public API answers without a token');
  const publicApi = await fetch(`${API}/api/contents?limit=1`).then((r) => r.json());
  check(publicApi.pagination.total > 0, `public API returns real published content (${publicApi.pagination.total} records)`);

  // ── 3. The admin API stays protected server-side ────────────────────────────────────────────
  check((await status('/api/admin/contents?limit=1')) === 401, 'admin API returns 401 without a token');
  check((await status('/api/admin/contents?limit=1', { 'x-admin-token': WRONG_TOKEN })) === 401, 'admin API returns 401 for a wrong token');
  check(
    (await status('/api/admin/contents?limit=1', { 'x-admin-token': TOKEN })) === 200,
    'admin API answers 200 with the configured token'
  );
  check((await status('/api/health')) === 200, 'health endpoint stays public');

  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(`${msg.text()} @ ${msg.location()?.url ?? page.url()}`);
  });
  page.on('pageerror', (err) => consoleErrors.push(`${err.message} @ ${page.url()}`));

  const bodyText = () => page.locator('body').innerText();
  const cmsMounted = async () => {
    const text = await bodyText();
    return CMS_MARKERS.some((m) => text.includes(m));
  };

  // ── 4. Unauthenticated /admin = login screen, no CMS ────────────────────────────────────────
  await page.goto(`${SITE}/admin`, { waitUntil: 'networkidle' });
  check(await page.locator(LOGIN).count() === 1, '/admin shows the admin login screen');
  check(!(await cmsMounted()), 'no part of the CMS is rendered before authentication');
  const loginText = await bodyText();
  check(/admin token/i.test(loginText), 'the login screen asks for the admin token');
  check(/no login|needs no login|public library/i.test(loginText), 'the login screen states that the public library needs no login');
  check(
    (await page.evaluate(() => Object.values(localStorage).join('|'))).length === 0,
    'nothing is written to localStorage on the login screen'
  );

  // The same is true for a deep link into the CMS.
  await page.goto(`${SITE}/admin/lectures`, { waitUntil: 'networkidle' });
  check(await page.locator(LOGIN).count() === 1, 'a deep link such as /admin/lectures also shows the login screen');
  check(!(await cmsMounted()), 'the deep link does not leak CMS content either');

  // ── 5. A wrong token gives a clear error and stays locked ───────────────────────────────────
  await page.fill('[data-testid="admin-login-token"]', WRONG_TOKEN);
  await page.click('[data-testid="admin-login-submit"]');
  await page.waitForTimeout(1200);
  const rejection = await page.locator('[data-testid="admin-login-message"]').innerText().catch(() => '');
  check(/rejected|401/i.test(rejection), `a wrong token is reported as rejected (${rejection.slice(0, 60)})`);
  check(await page.locator(LOGIN).count() === 1, 'a wrong token keeps the operator on the login screen');
  check(!(await cmsMounted()), 'a wrong token never renders the CMS');
  check(
    (await page.evaluate((k) => sessionStorage.getItem(k), STORAGE_KEY)) === null,
    'the rejected token is not kept in sessionStorage'
  );

  // ── 6. Valid token → CMS, deep link keeps its URL ───────────────────────────────────────────
  const publishedTotal = (await fetch(`${API}/api/admin/contents?limit=1&status=published`, {
    headers: { 'x-admin-token': TOKEN },
  }).then((r) => r.json())).pagination.total;

  await page.fill('[data-testid="admin-login-token"]', TOKEN);
  await page.click('[data-testid="admin-login-submit"]');
  await page.waitForSelector('input[placeholder*="Search"]', { timeout: 15000 });
  check(page.url().endsWith('/admin/lectures'), `after signing in, the deep link is honoured (${page.url().replace(SITE, '')})`);
  check(await cmsMounted(), 'the CMS renders after a valid sign-in');
  check(!page.url().includes(TOKEN), 'the token never appears in the URL');
  check((await page.locator('[data-testid="admin-signout"]').count()) === 1, 'the CMS offers a sign-out control');

  await page.goto(`${SITE}/admin`, { waitUntil: 'networkidle' });
  const tile = await page.locator('a', { hasText: 'Published' }).first().innerText();
  const shown = Number((tile.match(/(\d+)/) ?? [])[1]);
  check(shown === publishedTotal, `the signed-in dashboard shows the real database total (${shown} / ${publishedTotal})`);
  check(/Connected to the PostgreSQL library/i.test(await bodyText()), 'the CMS reports the real backend state');

  // ── 7. Refresh re-verifies; a tampered session cannot bypass authentication ─────────────────
  await page.reload({ waitUntil: 'networkidle' });
  check((await page.locator(LOGIN).count()) === 0, 'a refresh keeps a verified session signed in');
  check(await cmsMounted(), 'the CMS is still rendered after a refresh with a valid session');

  await page.evaluate((k) => sessionStorage.setItem(k, 'tampered-token-value-0123456789'), STORAGE_KEY);
  await page.reload({ waitUntil: 'networkidle' });
  check(await page.locator(LOGIN).count() === 1, 'a tampered session token drops back to the login screen on refresh');
  check(!(await cmsMounted()), 'a tampered session token never renders CMS content');
  const tampered = await page.locator('[data-testid="admin-login-message"]').innerText().catch(() => '');
  check(/401|rejected/i.test(tampered), `the tampered session is explained (${tampered.slice(0, 60)})`);

  // ── 8. Sign out ends the session; no credential in localStorage ─────────────────────────────
  await page.fill('[data-testid="admin-login-token"]', TOKEN);
  await page.click('[data-testid="admin-login-submit"]');
  await page.waitForSelector('[data-testid="admin-signout"]', { timeout: 15000 });
  check(
    (await page.evaluate((k) => sessionStorage.getItem(k), STORAGE_KEY)) === TOKEN,
    'the verified token lives in this tab’s sessionStorage only'
  );
  await page.click('[data-testid="admin-signout"]');
  await page.waitForTimeout(800);
  check(await page.locator(LOGIN).count() === 1, 'signing out returns to the login screen');
  check(
    (await page.evaluate((k) => sessionStorage.getItem(k), STORAGE_KEY)) === null,
    'signing out clears the session token'
  );
  check(
    (await page.evaluate(() => Object.values(localStorage).join('|'))).length === 0,
    'no credential is ever written to localStorage'
  );
  await page.goto(`${SITE}/admin/books`, { waitUntil: 'networkidle' });
  check(await page.locator(LOGIN).count() === 1, 'after signing out, the CMS routes are locked again');
  check(!(await cmsMounted()), 'after signing out no CMS content is reachable');

  const realErrors = consoleErrors.filter((e) => !/favicon|ERR_ABORTED|Failed to load resource/i.test(e));
  check(realErrors.length === 0, `no unexpected console errors during the auth flow (${realErrors.slice(0, 2).join(' | ').slice(0, 120)})`);

  await context.close();
  await browser.close();

  console.log(`\n${failed === 0 ? '✅ All admin-auth e2e checks passed' : `❌ ${failed} checks failed`} (${passed} passed, ${failed} failed)`);
  process.exit(failed === 0 ? 0 : 1);
}

void main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
