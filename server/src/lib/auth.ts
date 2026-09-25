/**
 * Admin authentication (Fase 4.5).
 *
 * Operators sign in with a username + password; the API issues a server-side session instead of
 * expecting a shared token on every request. Everything here uses `node:crypto` only — no new
 * dependency:
 *
 *   password  → scrypt (N=16384, r=8, p=1, 64-byte key, 16-byte random salt), stored as
 *               `scrypt$N$r$p$<salt b64>$<hash b64>`
 *   session   → 32 random bytes (hex) as the cookie value; the database stores only the SHA-256
 *               hash, so a database dump cannot be replayed against the API
 *   cookie    → `HttpOnly; Secure; SameSite=Lax; Path=/` — JavaScript can never read it
 *
 * The credential lives in the browser cookie jar and nowhere else: no localStorage, no
 * sessionStorage, no build-time token. The legacy `ADMIN_TOKEN` keeps working as a dual-mode
 * fallback for scripts and CI (see `server.ts`).
 */
import crypto from 'crypto';
import { promisify } from 'util';
import { prisma } from './prisma';

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: crypto.ScryptOptions,
) => Promise<Buffer>;

// ── Password hashing ────────────────────────────────────────────────────────────
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 200;

/** A few values that must never guard a deployment (mirrors the ADMIN_TOKEN rules). */
const WEAK_PASSWORDS = new Set(['password', 'passw0rd', 'changeme', 'admin', 'admin123', 'ilmnet', 'ilmnet-admin']);

export function assertPasswordPolicy(password: string, username?: string): void {
  const value = password ?? '';
  if (value.trim().length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }
  if (value.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password must be at most ${MAX_PASSWORD_LENGTH} characters long.`);
  }
  const lowered = value.trim().toLowerCase();
  if (WEAK_PASSWORDS.has(lowered)) {
    throw new Error('That password is a well-known default and must never guard the admin CMS.');
  }
  if (username && lowered === username.trim().toLowerCase()) {
    throw new Error('Password must not be the same as the username.');
  }
}

/** Hash a password for storage. Returns `scrypt$N$r$p$salt$hash`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LEN);
  const derived = await scrypt(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

/** Constant-time verification of a password against a stored hash. */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nRaw, rRaw, pRaw, saltRaw, hashRaw] = parts;
  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  const expected = Buffer.from(hashRaw, 'base64');
  if (!expected.length) return false;
  let derived: Buffer;
  try {
    derived = await scrypt(password, Buffer.from(saltRaw, 'base64'), expected.length, { N, r, p });
  } catch {
    return false;
  }
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

/**
 * Burn comparable CPU time when the username does not exist, so “unknown user” and “wrong
 * password” cannot be told apart by response time.
 */
export async function dummyPasswordCheck(): Promise<void> {
  await scrypt('ilmnet-timing-equalizer', crypto.randomBytes(SALT_LEN), KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
}

export function normalizeUsername(username: string): string {
  return (username ?? '').trim().toLowerCase();
}

// ── Sessions ────────────────────────────────────────────────────────────────────
export const SESSION_COOKIE = 'ilmnet_admin_session';
const SESSION_TOKEN_BYTES = 32;
const DEFAULT_TTL_MINUTES = 720; // 12 hours
const TOUCH_INTERVAL_MS = 5 * 60 * 1000; // write lastSeenAt at most every 5 minutes
const ABSOLUTE_MAX_MS = 30 * 24 * 60 * 60 * 1000; // a session never lives longer than 30 days

/** Session lifetime; `ADMIN_SESSION_TTL_MINUTES` may shorten/extend it (clamped 5 min – 30 days). */
export function sessionTtlMs(): number {
  const raw = Number(process.env.ADMIN_SESSION_TTL_MINUTES);
  const minutes = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_MINUTES;
  return Math.min(Math.max(minutes, 5), 30 * 24 * 60) * 60 * 1000;
}

export function generateSessionToken(): string {
  return crypto.randomBytes(SESSION_TOKEN_BYTES).toString('hex');
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

export interface AdminSessionUser {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
}

export interface ResolvedSession {
  sessionId: string;
  expiresAt: Date;
  /** When the session was last used — `touchAdminSession` throttles its own writes with it. */
  lastSeenAt: Date;
  user: AdminSessionUser;
}

function toUser(row: { id: string; username: string; displayName: string | null; role: string }): AdminSessionUser {
  return { id: row.id, username: row.username, displayName: row.displayName, role: row.role };
}

/** Create a session for a user; the returned token is the only copy that will ever exist. */
export async function createAdminSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + sessionTtlMs());
  await prisma.adminSession.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt,
      userAgent: meta.userAgent ? String(meta.userAgent).slice(0, 300) : null,
      ip: meta.ip ? String(meta.ip).slice(0, 100) : null,
    },
  });
  return { token, expiresAt };
}

/**
 * Look up a session by its raw token. Returns null for unknown, expired, over-age or disabled
 * accounts — every rejection reason looks identical from the outside.
 */
export async function resolveAdminSession(token: string | null | undefined): Promise<ResolvedSession | null> {
  if (!token || token.length < 32) return null;
  const row = await prisma.adminSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });
  if (!row) return null;
  const now = Date.now();
  if (row.expiresAt.getTime() <= now) {
    await prisma.adminSession.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }
  if (now - row.createdAt.getTime() > ABSOLUTE_MAX_MS) {
    await prisma.adminSession.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }
  if (row.user.disabled) return null;
  return { sessionId: row.id, expiresAt: row.expiresAt, lastSeenAt: row.lastSeenAt, user: toUser(row.user) };
}

/** Rolling session: refresh `lastSeenAt` (and the expiry) without writing on every request. */
export async function touchAdminSession(session: ResolvedSession): Promise<void> {
  const now = new Date();
  if (now.getTime() - session.lastSeenAt.getTime() < TOUCH_INTERVAL_MS) return;
  const expiresAt = new Date(Math.min(now.getTime() + sessionTtlMs(), now.getTime() + ABSOLUTE_MAX_MS));
  await prisma.adminSession
    .update({ where: { id: session.sessionId }, data: { lastSeenAt: now, expiresAt } })
    .catch(() => {});
}

/** Destroy one session (sign-out) or every session of a user (password change, disable). */
export async function destroyAdminSession(token: string): Promise<boolean> {
  if (!token) return false;
  const result = await prisma.adminSession.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  return result.count > 0;
}

export async function destroyUserSessions(userId: string): Promise<number> {
  const result = await prisma.adminSession.deleteMany({ where: { userId } });
  return result.count;
}

/** Housekeeping: drop sessions that can no longer be used. */
export async function purgeExpiredSessions(): Promise<number> {
  const result = await prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return result.count;
}

// ── Cookies (no @fastify/cookie dependency: the header is parsed/serialised here) ──
export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 1) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

export function readSessionCookie(cookieHeader: string | undefined): string | null {
  const value = parseCookieHeader(cookieHeader)[SESSION_COOKIE];
  return value && value.trim() ? value.trim() : null;
}

/**
 * `HttpOnly` keeps the session away from JavaScript, `Secure` keeps it off plain HTTP,
 * `SameSite=Lax` stops cross-site POSTs from riding on it (the cookie is therefore also the CSRF
 * defence — no separate token needed for this API).
 */
export function sessionCookieHeader(token: string, expiresAt: Date): string {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ].join('; ');
}

export function clearedSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// ── Login throttling (in-process, no dependency) ─────────────────────────────────
// Deliberately simple: one process, one Map. A forged username cannot lock a real account out for
// other operators (the counter is per username+IP), and username spraying from one address hits the
// blanket per-IP ceiling. Entries expire with the window, so the map stays small.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5; // per username + IP inside the window
const LOGIN_MAX_FAILURES_PER_IP = 20; // blanket ceiling for one address
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const MAX_TRACKED_KEYS = 5000;

type Attempt = { failures: number[]; blockedUntil: number };
const attempts = new Map<string, Attempt>();

function prune(now: number): void {
  if (attempts.size <= MAX_TRACKED_KEYS) return;
  for (const [key, entry] of attempts) {
    const alive = entry.blockedUntil > now || entry.failures.some((t) => now - t < LOGIN_WINDOW_MS);
    if (!alive) attempts.delete(key);
  }
}

function recordFailure(key: string, maxFailures: number): void {
  const now = Date.now();
  const entry = attempts.get(key) ?? { failures: [], blockedUntil: 0 };
  entry.failures = entry.failures.filter((t) => now - t < LOGIN_WINDOW_MS);
  entry.failures.push(now);
  if (entry.failures.length >= maxFailures) entry.blockedUntil = now + LOGIN_BLOCK_MS;
  attempts.set(key, entry);
  prune(now);
}

/** Seconds a blocked key still has to wait (0 = not blocked). */
function blockedFor(key: string, maxFailures: number): number {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry) return 0;
  entry.failures = entry.failures.filter((t) => now - t < LOGIN_WINDOW_MS);
  if (entry.failures.length >= maxFailures && entry.blockedUntil <= now) {
    entry.blockedUntil = now + LOGIN_BLOCK_MS;
  }
  return entry.blockedUntil > now ? Math.ceil((entry.blockedUntil - now) / 1000) : 0;
}

/** Seconds the caller must wait before this username/IP pair may try again. */
export function loginBlockedFor(username: string, ip: string): number {
  return Math.max(
    blockedFor(`${normalizeUsername(username)}|${ip}`, LOGIN_MAX_FAILURES),
    blockedFor(`ip:${ip}`, LOGIN_MAX_FAILURES_PER_IP),
  );
}

export function registerLoginFailure(username: string, ip: string): void {
  recordFailure(`${normalizeUsername(username)}|${ip}`, LOGIN_MAX_FAILURES);
  recordFailure(`ip:${ip}`, LOGIN_MAX_FAILURES_PER_IP);
}

export function clearLoginFailures(username: string, ip: string): void {
  attempts.delete(`${normalizeUsername(username)}|${ip}`);
  attempts.delete(`ip:${ip}`);
}

/** Test hook: forget every recorded attempt (never used in production paths). */
export function resetLoginThrottle(): void {
  attempts.clear();
}

// ── Who is calling? ──────────────────────────────────────────────────────────────
/**
 * Attachment point filled in by the admin-protection hook in `server.ts`. `token` and `localhost`
 * are identity-less on purpose: the legacy shared token and the development convenience cannot name
 * a person, so attribution stays `null` instead of inventing one.
 */
export type AdminRequestAuth =
  | { method: 'session'; username: string; userId: string; sessionId: string }
  | { method: 'token'; username: null; userId: null; sessionId: null }
  | { method: 'localhost'; username: null; userId: null; sessionId: null };

/** The username to attribute a write to, or null when the caller has no identity. */
export function adminUsername(req: { adminAuth?: AdminRequestAuth | null }): string | null {
  return req.adminAuth?.method === 'session' ? req.adminAuth.username : null;
}
