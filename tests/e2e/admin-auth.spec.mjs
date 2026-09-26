/**
 * Fase 4.5 — real admin authentication in a real browser, against the real API.
 *
 *   cd server && npm run build
 *   NODE_ENV=production ADMIN_TOKEN=… CORS_ORIGIN=http://localhost:3101 node dist/server.js
 *   npm run admin:create -- --username e2e-admin --password '…'          # in server/
 *   ADMIN_TOKEN=… ADMIN_USERNAME=e2e-admin ADMIN_PASSWORD=… node tests/e2e/admin-auth.spec.mjs
 *
 * What it proves (no mocks, no shortcuts):
 *   1. no credential — not the legacy token, not the password — is anywhere in the shipped bundle;
 *   2. the public site and the public API stay open — no login needed;
 *   3. the admin API is protected server-side: 401 without a session, 401 for wrong credentials,
 *      and the legacy ADMIN_TOKEN still works as the documented dual-mode fallback;
 *   4. /admin shows a real username/password login and no part of the CMS while unauthenticated;
 *   5. wrong credentials produce a clear error and never unlock the CMS;
 *   6. valid credentials sign in, also from a deep link (/admin/lectures keeps its URL);
 *   7. refresh re-verifies with the API; a tampered session cookie drops back to the login;
 *   8. signing out destroys the session server-side — the captured cookie is dead afterwards;
 *   9. no credential ever reaches localStorage or sessionStorage.
 */
import { chromium } from 'playwright';
import { E2E_PASSWORD, E2E_USERNAME, apiLogin, sessionCookieFor, tamperedCookieFor } from './lib/admin-session.mjs';
import { announceTargetEnvironment } from './lib/env-banner.mjs';

const SITE = process.env.SITE_URL || 'http://localhost:3101';
const API = process.env.API_URL || SITE;
const TOKEN = process.env.ADMIN_TOKEN || 'prod-test-token-1234567890';

await announceTargetEnvironment('admin authentication (browser)', { site: SITE, api: API });

// Markers that only exist inside the CMS (never on the login screen).
const CMS_MARKERS = ['Add content', 'Published lectures', 'Archive.org Bulk'];
const LOGIN = '[data-testid="admin-login"]';
const STORAGE_KEYS = ['ilmnet.adminToken'];

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
  if (!E2E_PASSWORD) {
    console.error(
      [
        '❌ ADMIN_PASSWORD is not set — this suite signs in as a real operator.',
        '   cd server && npm run admin:create -- --username e2e-admin --password \'<test password>\'',
        "   ADMIN_PASSWORD='<test password>' node tests/e2e/admin-auth.spec.mjs",
      ].join('\n'),
    );
    process.exit(1);
  }
  const browser = await chromium.launch();

  // ── 1. No credential in the shipped frontend ─────────────────────────────────────────────────
  const html = await fetch(`${SITE}/`).then((r) => r.text());
  check(!html.includes(TOKEN), 'the legacy admin token is not present in the built frontend');
  check(!html.includes(E2E_PASSWORD), 'the admin password is not present in the built frontend');
  check(!html.includes('ilmnet.adminToken'), 'the bundle still knows nothing about a stored credential');
  check(!/ilmnet_(prod|admin)[_-]?[a-z0-9]{6,}/i.test(html), 'the bundle contains no hardcoded admin token pattern');

  // ── 2. The public side needs no login ───────────────────────────────────────────────────────
  const publicRoutes = ['/', '/lectures', '/books', '/scholars', '/subjects'];
  for (const route of publicRoutes) {
    check((await status(route)) === 200, `public route ${route} stays public (no login)`);
  }
  check((await status('/api/contents?limit=1')) === 200, 'public API answers without a session');
  const publicApi = await fetch(`${API}/api/contents?limit=1`).then((r) => r.json());
  check(publicApi.pagination.total > 0, `public API returns real published content (${publicApi.pagination.total} records)`);

  // ── 3. The admin API stays protected server-side ────────────────────────────────────────────
  check((await status('/api/admin/contents?limit=1')) === 401, 'admin API returns 401 without a session');
  check((await status('/api/admin/session')) === 401, 'the session endpoint returns 401 without a session');
  const wrongLogin = await apiLogin(API, E2E_USERNAME, 'definitely-not-the-password');
  check(wrongLogin.status === 401, `the login endpoint rejects wrong credentials (${wrongLogin.status})`);
  check(!wrongLogin.cookie, 'a rejected sign-in issues no session cookie');
  const unknownLogin = await apiLogin(API, 'no-such-operator-at-all', 'definitely-not-the-password');
  check(
    unknownLogin.status === 401 && unknownLogin.body?.error?.message === wrongLogin.body?.error?.message,
    'unknown user and wrong password are indistinguishable'
  );
  check(
    (await status('/api/admin/contents?limit=1', { 'x-admin-token': TOKEN })) === 200,
    'the legacy ADMIN_TOKEN still answers 200 (dual-mode fallback)'
  );
  check((await status('/api/admin/contents?limit=1', { 'x-admin-token': 'wrong-token-0123456789' })) === 401, 'a wrong token still gives 401');
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
  const storageDump = async () => {
    const local = await page.evaluate(() => Object.values(localStorage).join('|'));
    const session = await page.evaluate(() => Object.values(sessionStorage).join('|'));
    return `${local}|${session}`;
  };

  // ── 4. Unauthenticated /admin = login screen, no CMS ────────────────────────────────────────
  await page.goto(`${SITE}/admin`, { waitUntil: 'networkidle' });
  check((await page.locator(LOGIN).count()) === 1, '/admin shows the admin login screen');
  check(!(await cmsMounted()), 'no part of the CMS is rendered before authentication');
  const loginText = await bodyText();
  check(/username/i.test(loginText) && /password/i.test(loginText), 'the login screen asks for a username and a password');
  check(!/paste the admin_token|admin token configured/i.test(loginText), 'the login screen no longer asks for a pasted token');
  check(/no login|needs no login|public library/i.test(loginText), 'the login screen states that the public library needs no login');
  check(
    (await page.evaluate(() => Object.values(localStorage).join('|'))).length === 0,
    'nothing is written to localStorage on the login screen'
  );
  check((await storageDump()).replace(/\|/g, '').length === 0, 'nothing is written to sessionStorage either');

  // The same is true for a deep link into the CMS.
  await page.goto(`${SITE}/admin/lectures`, { waitUntil: 'networkidle' });
  check((await page.locator(LOGIN).count()) === 1, 'a deep link such as /admin/lectures also shows the login screen');
  check(!(await cmsMounted()), 'the deep link does not leak CMS content either');

  // ── 5. Wrong credentials give a clear error and stay locked ─────────────────────────────────
  await page.fill('[data-testid="admin-login-username"]', E2E_USERNAME);
  await page.fill('[data-testid="admin-login-password"]', 'definitely-not-the-password');
  await page.click('[data-testid="admin-login-submit"]');
  await page.waitForTimeout(1500);
  const rejection = await page.locator('[data-testid="admin-login-message"]').innerText().catch(() => '');
  check(/not accepted|invalid|rejected/i.test(rejection), `wrong credentials are reported clearly (${rejection.slice(0, 60)})`);
  check((await page.locator(LOGIN).count()) === 1, 'wrong credentials keep the operator on the login screen');
  check(!(await cmsMounted()), 'wrong credentials never render the CMS');
  check((await storageDump()).replace(/\|/g, '').length === 0, 'the rejected attempt stores nothing in the browser');
  check(
    (await context.cookies()).every((c) => c.name !== 'ilmnet_admin_session'),
    'a rejected sign-in leaves no session cookie'
  );

  // ── 6. Valid credentials → CMS, deep link keeps its URL ─────────────────────────────────────
  const publishedTotal = (await fetch(`${API}/api/admin/contents?limit=1&status=published`, {
    headers: { 'x-admin-token': TOKEN },
  }).then((r) => r.json())).pagination.total;

  await page.fill('[data-testid="admin-login-password"]', E2E_PASSWORD);
  await page.click('[data-testid="admin-login-submit"]');
  await page.waitForSelector('[data-testid="admin-signout"]', { timeout: 15000 });
  check(page.url().endsWith('/admin/lectures'), `after signing in, the deep link is honoured (${page.url().replace(SITE, '')})`);
  check(await cmsMounted(), 'the CMS renders after a valid sign-in');
  check(!page.url().includes(E2E_PASSWORD), 'the password never appears in the URL');
  check((await page.locator('[data-testid="admin-signout"]').count()) === 1, 'the CMS offers a sign-out control');
  const identity = await page.locator('[data-testid="admin-signed-in-as"]').innerText().catch(() => '');
  check(identity.includes(E2E_USERNAME), `the CMS names the signed-in operator (${identity.replace(/\n/g, ' ').slice(0, 40)})`);

  const cookies = await context.cookies();
  const sessionCookie = cookies.find((c) => c.name === 'ilmnet_admin_session');
  check(Boolean(sessionCookie), 'the API issued a session cookie');
  check(sessionCookie?.httpOnly === true, 'the session cookie is HttpOnly (JavaScript cannot read it)');
  check(sessionCookie?.secure === true, 'the session cookie is Secure');
  check(String(sessionCookie?.sameSite).toLowerCase() === 'lax', 'the session cookie is SameSite=Lax');
  check(
    (await page.evaluate(() => document.cookie)).indexOf('ilmnet_admin_session') === -1,
    'the session cookie is invisible to document.cookie'
  );
  check((await storageDump()).replace(/\|/g, '').length === 0, 'the signed-in browser stores no credential in web storage');

  await page.goto(`${SITE}/admin`, { waitUntil: 'networkidle' });
  const tile = await page.locator('a', { hasText: 'Published' }).first().innerText();
  const shown = Number((tile.match(/(\d+)/) ?? [])[1]);
  check(shown === publishedTotal, `the signed-in dashboard shows the real database total (${shown} / ${publishedTotal})`);
  check(/Connected to the PostgreSQL library/i.test(await bodyText()), 'the CMS reports the real backend state');

  // ── 7. Refresh re-verifies; a tampered cookie cannot bypass authentication ──────────────────
  await page.reload({ waitUntil: 'networkidle' });
  check((await page.locator(LOGIN).count()) === 0, 'a refresh keeps a verified session signed in');
  check(await cmsMounted(), 'the CMS is still rendered after a refresh with a valid session');

  await context.clearCookies();
  await context.addCookies([tamperedCookieFor(SITE)]);
  await page.reload({ waitUntil: 'networkidle' });
  check((await page.locator(LOGIN).count()) === 1, 'a tampered session cookie drops back to the login screen');
  check(!(await cmsMounted()), 'a tampered session cookie never renders CMS content');

  // ── 8. Sign out destroys the session server-side ────────────────────────────────────────────
  const login = await apiLogin(API);
  const captured = sessionCookieFor(SITE, login.setCookie);
  await context.clearCookies();
  await context.addCookies([captured]);
  await page.goto(`${SITE}/admin`, { waitUntil: 'networkidle' });
  check(await cmsMounted(), 'a valid session cookie signs the browser in without typing anything again');

  const capturedHeader = `ilmnet_admin_session=${captured.value}`;
  check(
    (await fetch(`${API}/api/admin/session`, { headers: { cookie: capturedHeader } }).then((r) => r.status)) === 200,
    'the captured cookie is valid before signing out'
  );

  await page.click('[data-testid="admin-signout"]');
  await page.waitForTimeout(1200);
  check((await page.locator(LOGIN).count()) === 1, 'signing out returns to the login screen');
  check((await page.evaluate(() => document.cookie)).indexOf('ilmnet_admin_session') === -1, 'signing out clears the cookie in the browser');
  check((await storageDump()).replace(/\|/g, '').length === 0, 'signing out leaves nothing in web storage');
  check(
    (await fetch(`${API}/api/admin/session`, { headers: { cookie: capturedHeader } }).then((r) => r.status)) === 401,
    'the session is destroyed server-side (the captured cookie is dead)'
  );
  await page.goto(`${SITE}/admin/books`, { waitUntil: 'networkidle' });
  check((await page.locator(LOGIN).count()) === 1, 'after signing out, the CMS routes are locked again');
  check(!(await cmsMounted()), 'after signing out no CMS content is reachable');

  for (const key of STORAGE_KEYS) {
    check(
      (await page.evaluate((k) => localStorage.getItem(k) ?? sessionStorage.getItem(k), key)) === null,
      `no credential under ${key} in web storage`
    );
  }

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
