/**
 * Shared e2e helper (Fase 4.5): sign a browser context in as a real admin.
 *
 * The CMS no longer accepts a token pasted into the browser — operators sign in with a username and
 * password, and the API returns an `HttpOnly` session cookie. Browser suites therefore log in over
 * the API and hand the resulting cookie to the Playwright context, which is exactly what the
 * operator's browser receives (nothing is injected into JavaScript-visible storage).
 *
 * Credentials come from `ADMIN_USERNAME` / `ADMIN_PASSWORD`; defaultwise the throwaway accounts the
 * runbook creates (`npm run admin:create -- --username e2e-admin --password …`) are used.
 */
export const E2E_USERNAME = process.env.ADMIN_USERNAME || 'e2e-admin';
/**
 * The password is deliberately **not** defaulted: a committed test password is a credential, and it
 * would sooner or later end up guarding a real deployment. Pass it via the environment.
 */
export const E2E_PASSWORD = process.env.ADMIN_PASSWORD || '';

/** Fail loudly (and helpfully) instead of silently running unauthenticated. */
export function requirePassword(username) {
  if (!E2E_PASSWORD) {
    throw new Error(
      [
        'ADMIN_PASSWORD is not set — the browser suites sign in as a real operator.',
        'Create the throwaway account once and export its password:',
        `  cd server && npm run admin:create -- --username ${username} --password '<test password>'`,
        "  export ADMIN_PASSWORD='<test password>'",
      ].join('\n'),
    );
  }
  return E2E_PASSWORD;
}

export const SESSION_COOKIE_NAME = 'ilmnet_admin_session';

/** POST /api/admin/login and return the session cookie the API issued. */
export async function apiLogin(apiBase, username = E2E_USERNAME, password = E2E_PASSWORD) {
  const res = await fetch(`${apiBase}/api/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const body = await res.json().catch(() => ({}));
  return {
    status: res.status,
    setCookie,
    cookie: setCookie ? setCookie.split(';')[0] : '',
    body,
    user: body?.data?.user ?? null,
  };
}

/** The cookie as a Playwright cookie object for the given site URL. */
export function sessionCookieFor(siteUrl, setCookieHeader) {
  const pair = setCookieHeader.split(';')[0];
  const name = pair.slice(0, pair.indexOf('='));
  const value = decodeURIComponent(pair.slice(pair.indexOf('=') + 1));
  return { name, value, url: new URL(siteUrl).origin, httpOnly: true, secure: true, sameSite: 'Lax' };
}

/**
 * Sign the context in: log in over the API, give the browser the cookie, and return the operator.
 * Throws when the credentials are rejected, so a suite never silently continues unauthenticated.
 */
export async function signInBrowser(context, siteUrl, username = E2E_USERNAME, password = E2E_PASSWORD) {
  const secret = password || requirePassword(username);
  const login = await apiLogin(new URL(siteUrl).origin, username, secret);
  if (login.status !== 200 || !login.cookie) {
    throw new Error(
      `e2e admin sign-in failed (${login.status}). Create the test account first: ` +
        `cd server && npm run admin:create -- --username ${username} --password '…'`,
    );
  }
  await context.addCookies([sessionCookieFor(siteUrl, login.setCookie)]);
  return login.user;
}

/** An obviously invalid session cookie — used to prove that a tampered cookie cannot unlock the CMS. */
export function tamperedCookieFor(siteUrl) {
  return { name: SESSION_COOKIE_NAME, value: 'f'.repeat(64), url: new URL(siteUrl).origin, httpOnly: true, secure: true, sameSite: 'Lax' };
}
