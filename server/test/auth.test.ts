/**
 * Fase 4.5 — real admin authentication (username + password, server-side sessions).
 *
 * Runs against a real HTTP server (`buildApp()` on an ephemeral port) and the real database:
 * password hashing, session storage, the login/logout/session endpoints, cookie flags, throttling,
 * the legacy `ADMIN_TOKEN` dual mode and attribution of writes to the signed-in operator.
 *
 *   NODE_ENV=test ADMIN_TOKEN=… npx tsx test/auth.test.ts
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildApp } from '../src/server';
import { prisma } from '../src/lib/prisma';
import {
  assertPasswordPolicy,
  dummyPasswordCheck,
  hashPassword,
  hashSessionToken,
  verifyPassword,
  resetLoginThrottle,
} from '../src/lib/auth';

// Starts with `test-` on purpose: the production boot guard (server/src/lib/env.ts) refuses it,
// so this suite default can never authenticate a real deployment.
const TOKEN = process.env.TEST_ADMIN_TOKEN || process.env.ADMIN_TOKEN || 'test-auth-suite-token-2f9c41a7e5';
const STAMP = Date.now().toString(36);
const USERNAME = `auth-suite-${STAMP}`;
const PASSWORD = `suite-password-${STAMP}-x`;

let passed = 0;
let failed = 0;
function ok(msg: string) {
  passed++;
  console.log(`✅ ${msg}`);
}
function fail(msg: string, err?: any) {
  failed++;
  console.error(`❌ ${msg}${err ? `: ${err?.message || err}` : ''}`);
  process.exitCode = 1;
}
function check(cond: unknown, msg: string) {
  if (cond) ok(msg);
  else fail(msg);
}

let base = '';
let cookie = ''; // the session cookie the API handed back
let userId = '';

async function api(path: string, init: RequestInit & { cookie?: string | null; token?: string | null } = {}) {
  const headers: Record<string, string> = { ...((init.headers as Record<string, string>) ?? {}) };
  if (init.body) headers['content-type'] = 'application/json';
  const jar = init.cookie === undefined ? cookie : init.cookie;
  if (jar) headers.cookie = jar;
  if (init.token) headers['x-admin-token'] = init.token;
  const res = await fetch(`${base}${path}`, { ...init, headers });
  const body: any = await res.json().catch(() => ({}));
  return { status: res.status, body, headers: res.headers, setCookie: res.headers.get('set-cookie') ?? '' };
}

// ── 1. Password hashing (scrypt, node:crypto only) ───────────────────────────────
async function testPasswordHashing() {
  console.log('\n--- 1. Password hashing (scrypt) ---');
  const hash = await hashPassword('correct horse battery staple');
  check(hash.startsWith('scrypt$16384$8$1$'), `hash uses the documented scrypt parameters (${hash.slice(0, 18)}…)`);
  check(!hash.includes('correct horse'), 'the hash contains no plaintext password');
  check(await verifyPassword('correct horse battery staple', hash), 'the correct password verifies');
  check(!(await verifyPassword('correct horse battery stapl', hash)), 'a wrong password is rejected');
  check(!(await verifyPassword('x', null)), 'a missing hash never verifies');
  const second = await hashPassword('correct horse battery staple');
  check(second !== hash, 'the same password produces a different hash every time (random salt)');
  check(await verifyPassword('correct horse battery staple', second), 'the second hash verifies as well');

  // policy
  const rejects: Array<[string, string]> = [['kort', 'too short'], ['admin', 'a known default']];
  for (const [value, why] of rejects) {
    try {
      assertPasswordPolicy(value);
      fail(`policy rejects ${why} (${value})`);
    } catch {
      ok(`policy rejects ${why}`);
    }
  }
  try {
    assertPasswordPolicy(`x${PASSWORD}`, 'x');
    ok('policy accepts a normal password');
  } catch (e: any) {
    fail('policy accepts a normal password', e);
  }
  try {
    assertPasswordPolicy('same-as-username-123', 'same-as-username-123');
    fail('policy rejects a password equal to the username');
  } catch {
    ok('policy rejects a password equal to the username');
  }
  await dummyPasswordCheck();
  ok('the timing equaliser runs without throwing');
}

// ── 2. Login / session / logout over HTTP ───────────────────────────────────────
async function testLoginFlow() {
  console.log('\n--- 2. Login, session, logout ---');

  const before = await api('/api/admin/session');
  check(before.status === 401, `GET /api/admin/session without a session → 401 (got ${before.status})`);

  const noCreds = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: USERNAME }) });
  check(noCreds.status === 400, `login without a password → 400 (got ${noCreds.status})`);

  const unknown = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: `nobody-${STAMP}`, password: 'whatever-long-enough' }) });
  check(unknown.status === 401, `login with an unknown user → 401 (got ${unknown.status})`);
  check(unknown.body?.error?.code === 'INVALID_CREDENTIALS', 'the unknown user gets the generic code (no user enumeration)');

  const wrong = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: USERNAME, password: 'definitely-wrong-password' }) });
  check(wrong.status === 401, `login with a wrong password → 401 (got ${wrong.status})`);
  check(
    wrong.body?.error?.message === unknown.body?.error?.message,
    'wrong password and unknown user return the identical message',
  );
  check(!/passwordHash/.test(JSON.stringify(wrong.body)) && !wrong.body?.data, 'a failed login returns no data or hash');

  const good = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: USERNAME, password: PASSWORD }) });
  check(good.status === 200, `login with the right credentials → 200 (got ${good.status})`);
  check(good.body?.data?.user?.username === USERNAME, 'the response names the signed-in operator');
  check(!JSON.stringify(good.body).includes('passwordHash'), 'the response never contains the password hash');
  check(!good.setCookie.includes(PASSWORD), 'the cookie never contains the password');

  const cookieHeader = good.setCookie;
  check(/HttpOnly/i.test(cookieHeader), 'the session cookie is HttpOnly (invisible to JavaScript)');
  check(/Secure/i.test(cookieHeader), 'the session cookie is Secure');
  check(/SameSite=Lax/i.test(cookieHeader), 'the session cookie is SameSite=Lax');
  check(/Path=\//.test(cookieHeader), 'the session cookie is scoped to the whole site');
  check(/Max-Age=\d+/.test(cookieHeader), 'the session cookie expires with the session');

  cookie = cookieHeader.split(';')[0];
  const rawToken = decodeURIComponent(cookie.split('=')[1]);
  check(rawToken.length === 64, `the session token is 32 random bytes, hex-encoded (${rawToken.length} chars)`);

  const stored = await prisma.adminSession.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
  check(Boolean(stored), 'the session is stored server-side');
  check(stored?.tokenHash === hashSessionToken(rawToken), 'the database stores only the SHA-256 hash of the token');
  check(!JSON.stringify(stored).includes(rawToken), 'the raw token appears nowhere in the database row');

  const me = await api('/api/admin/session');
  check(me.status === 200, `GET /api/admin/session with the cookie → 200 (got ${me.status})`);
  check(me.body?.data?.authenticated === true && me.body?.data?.method === 'session', 'the session endpoint reports a real session');
  check(me.body?.data?.user?.username === USERNAME, 'the session endpoint names the operator');

  const adminRead = await api('/api/admin/contents?limit=1');
  check(adminRead.status === 200, `an admin read is authorised by the cookie alone (no token header) → 200 (got ${adminRead.status})`);

  const write = await api('/api/admin/contents', {
    method: 'POST',
    body: JSON.stringify({
      type: 'lecture',
      title: `Auth suite record ${STAMP}`,
      description: 'created by the auth suite to verify attribution',
      provider: 'external',
      sourceUrl: `https://example.org/auth-suite/${STAMP}`,
      externalIdentifier: `auth-suite-${STAMP}`,
      status: 'draft',
    }),
  });
  check(write.status === 201, `a write is authorised by the cookie → 201 (got ${write.status})`);
  const contentId = write.body?.data?.id;
  check(write.body?.data?.createdBy === USERNAME, `createdBy is the signed-in operator (${write.body?.data?.createdBy})`);
  check(write.body?.data?.updatedBy === USERNAME, 'the same write also records updatedBy');

  const patched = await api(`/api/admin/contents/${contentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ description: 'edited by the auth suite' }),
  });
  check(patched.status === 200, `PATCH with the cookie → 200 (got ${patched.status})`);
  check(patched.body?.data?.updatedBy === USERNAME, 'a later edit updates updatedBy');
  check(patched.body?.data?.createdBy === USERNAME, 'createdBy keeps the original author');

  const tokenWrite = await api('/api/admin/contents', {
    method: 'POST',
    token: TOKEN,
    cookie: null,
    body: JSON.stringify({
      type: 'lecture',
      title: `Auth suite token record ${STAMP}`,
      provider: 'external',
      sourceUrl: `https://example.org/auth-suite-token/${STAMP}`,
      externalIdentifier: `auth-suite-token-${STAMP}`,
      status: 'draft',
    }),
  });
  check(tokenWrite.status === 201, `the legacy ADMIN_TOKEN still authorises a write → 201 (got ${tokenWrite.status})`);
  check(tokenWrite.body?.data?.createdBy === null, 'token-authorised writes carry no invented username (createdBy = null)');
  const tokenContentId = tokenWrite.body?.data?.id;
  if (tokenContentId) await prisma.content.delete({ where: { id: tokenContentId } }).catch(() => {});

  const logout = await api('/api/admin/logout', { method: 'POST' });
  check(logout.status === 200, `logout → 200 (got ${logout.status})`);
  check(/Max-Age=0/.test(logout.setCookie), 'logout clears the cookie (Max-Age=0)');
  check(logout.body?.data?.sessionDestroyed === true, 'logout destroys the server-side session');

  const after = await api('/api/admin/session');
  check(after.status === 401, `after logout the old cookie is dead → 401 (got ${after.status})`);
  const storedAfter = await prisma.adminSession.findFirst({ where: { userId } });
  check(storedAfter === null, 'no session row survives a logout');

  if (contentId) await prisma.content.delete({ where: { id: contentId } }).catch(() => {});
}

// ── 3. Session integrity, expiry and revocation ─────────────────────────────────
async function testSessionIntegrity() {
  console.log('\n--- 3. Session integrity, expiry, revocation ---');

  // tampered cookie
  const tampered = await api('/api/admin/session', { cookie: `ilmnet_admin_session=${'f'.repeat(64)}` });
  check(tampered.status === 401, `a forged session token → 401 (got ${tampered.status})`);
  check(/Max-Age=0/.test(tampered.setCookie), 'a rejected cookie is cleared in the response');

  // expired session
  const login = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: USERNAME, password: PASSWORD }) });
  const sessionCookie = login.setCookie.split(';')[0];
  const token = decodeURIComponent(sessionCookie.split('=')[1]);
  await prisma.adminSession.update({
    where: { tokenHash: hashSessionToken(token) },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  const expired = await api('/api/admin/session', { cookie: sessionCookie });
  check(expired.status === 401, `an expired session → 401 (got ${expired.status})`);
  const purged = await prisma.adminSession.findFirst({ where: { tokenHash: hashSessionToken(token) } });
  check(purged === null, 'the expired session row is removed on use');

  // disabled user: cannot sign in, and existing sessions stop working
  const second = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: USERNAME, password: PASSWORD }) });
  const secondCookie = second.setCookie.split(';')[0];
  await prisma.adminUser.update({ where: { id: userId }, data: { disabled: true } });
  const disabledLogin = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: USERNAME, password: PASSWORD }) });
  check(disabledLogin.status === 401, `a disabled account cannot sign in → 401 (got ${disabledLogin.status})`);
  const disabledSession = await api('/api/admin/session', { cookie: secondCookie });
  check(disabledSession.status === 401, `an existing session of a disabled account → 401 (got ${disabledSession.status})`);
  await prisma.adminUser.update({ where: { id: userId }, data: { disabled: false } });

  // another 64-byte token that is not ours (valid shape, unknown value)
  const unknown = await api('/api/admin/session', { cookie: `ilmnet_admin_session=${crypto.randomBytes(32).toString('hex')}` });
  check(unknown.status === 401, `an unknown but well-formed token → 401 (got ${unknown.status})`);
}

// ── 4. Legacy token dual mode + throttling ──────────────────────────────────────
async function testTokenFallbackAndThrottle() {
  console.log('\n--- 4. Legacy token fallback and login throttling ---');

  const tokenRead = await api('/api/admin/contents?limit=1', { token: TOKEN, cookie: null });
  check(tokenRead.status === 200, `the legacy ADMIN_TOKEN still reads admin data → 200 (got ${tokenRead.status})`);
  const tokenSession = await api('/api/admin/session', { token: TOKEN, cookie: null });
  check(tokenSession.status === 200 && tokenSession.body?.data?.method === 'token', 'the session endpoint reports token authorisation honestly');
  check(tokenSession.body?.data?.user === null, 'token mode reports no user (no invented identity)');
  const badToken = await api('/api/admin/contents?limit=1', { token: 'not-the-token-at-all', cookie: null });
  check(badToken.status === 401, `a wrong token → 401 (got ${badToken.status})`);
  const noCreds = await api('/api/admin/contents?limit=1', { cookie: null });
  check(noCreds.status === 401, `no cookie and no token → 401 (got ${noCreds.status})`);

  // throttle after five failures for one username
  resetLoginThrottle();
  const victim = `auth-suite-throttle-${STAMP}`;
  for (let i = 0; i < 5; i++) {
    await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: victim, password: 'wrong-password-here' }) });
  }
  const blocked = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: victim, password: 'wrong-password-here' }) });
  check(blocked.status === 429, `the sixth attempt for one username → 429 (got ${blocked.status})`);
  check(Number(blocked.headers.get('retry-after') ?? 0) > 0, 'the 429 carries a Retry-After hint');
  const stillOk = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: USERNAME, password: PASSWORD }) });
  check(stillOk.status === 200, 'a different username is not affected by that block');
  if (stillOk.setCookie) {
    await api('/api/admin/logout', { method: 'POST', cookie: stillOk.setCookie.split(';')[0] });
  }
  resetLoginThrottle();
  ok('the throttle state is reset for the remaining suites');
}

// ── 5. Import attribution (network: YouTube preview) ────────────────────────────
async function testImportAttribution() {
  console.log('\n--- 5. Import-job attribution ---');
  const login = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: USERNAME, password: PASSWORD }) });
  const sessionCookie = login.setCookie.split(';')[0];

  const preview = await api('/api/admin/imports/youtube/preview', {
    method: 'POST',
    cookie: sessionCookie,
    body: JSON.stringify({ sourceUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
  });
  if (preview.status !== 200) {
    console.log(`⚠️  skipped: the YouTube preview returned ${preview.status} (provider unreachable) — attribution is covered by the content checks above`);
    return;
  }
  const job = await prisma.importJob.findFirst({ where: { id: preview.body?.jobId } });
  check(job?.createdBy === USERNAME, `an import job records the operator who ran it (createdBy=${job?.createdBy})`);
  await prisma.importJob.delete({ where: { id: job!.id } }).catch(() => {});
  await api('/api/admin/logout', { method: 'POST', cookie: sessionCookie });
}

async function cleanup() {
  console.log('\n--- cleanup ---');
  await prisma.content.deleteMany({ where: { externalIdentifier: { startsWith: `auth-suite-${STAMP}` } } });
  const leftover = await prisma.content.count({ where: { externalIdentifier: { startsWith: `auth-suite-${STAMP}` } } });
  check(leftover === 0, 'the suite left no content behind');
  await prisma.adminSession.deleteMany({ where: { userId } });
  const deleted = await prisma.adminUser.deleteMany({ where: { username: USERNAME } });
  check(deleted.count === 1, 'the suite removed its own admin account');
  check((await prisma.adminSession.count({ where: { userId } })) === 0, 'no session rows are left behind');
}

async function main() {
  // The suite is the operator: no session cookie exists yet and the localhost convenience is off,
  // so every check below exercises the real protection hook.
  process.env.NODE_ENV = 'test';
  process.env.ADMIN_TOKEN = TOKEN;
  process.env.ADMIN_ALLOW_LOCALHOST = 'false';
  process.env.CORS_ORIGIN = 'http://localhost:3101';

  const app = await buildApp();
  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  base = address.replace('0.0.0.0', '127.0.0.1');
  console.log(`API on ${base} · suite account ${USERNAME}`);

  const created = await prisma.adminUser.create({
    data: { username: USERNAME, displayName: 'Auth suite', passwordHash: await hashPassword(PASSWORD) },
  });
  userId = created.id;

  try {
    await testPasswordHashing();
    await testLoginFlow();
    await testSessionIntegrity();
    await testTokenFallbackAndThrottle();
    await testImportAttribution();
  } finally {
    await cleanup();
    await app.close();
    await prisma.$disconnect();
  }

  console.log(`\n${failed === 0 ? '✅' : '❌'} auth suite: ${passed} passed, ${failed} failed`);
  if (failed) process.exitCode = 1;
}

main().catch(async (err) => {
  console.error('❌ suite crashed:', err);
  process.exitCode = 1;
  await prisma.$disconnect();
});
