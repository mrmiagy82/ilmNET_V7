/**
 * Admin authentication endpoints (Fase 4.5).
 *
 *   POST /api/admin/login    username + password → server-side session + HttpOnly cookie
 *   POST /api/admin/logout   destroys the presented session and clears the cookie (idempotent)
 *   GET  /api/admin/session  who is calling: `session` (real account) or `token` (legacy fallback)
 *
 * `/login` and `/logout` are the only admin paths that are reachable without credentials — the
 * protection hook in `server.ts` deliberately lets them through, everything else under
 * `/api/admin/*` (and every write under `/api/*`) needs a valid session or the legacy token.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  adminUsername,
  clearLoginFailures,
  clearedSessionCookieHeader,
  createAdminSession,
  destroyAdminSession,
  dummyPasswordCheck,
  loginBlockedFor,
  normalizeUsername,
  purgeExpiredSessions,
  readSessionCookie,
  registerLoginFailure,
  sessionCookieHeader,
  verifyPassword,
} from '../lib/auth';

const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
});

export async function authRoutes(app: FastifyInstance) {
  // ── Sign in ──
  app.post('/api/admin/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: 'A username and a password are required.' },
      });
    }
    const username = normalizeUsername(parsed.data.username);
    const ip = (req.ip || '').toString();

    const waitSeconds = loginBlockedFor(username, ip);
    if (waitSeconds > 0) {
      reply.header('retry-after', String(waitSeconds));
      return reply.code(429).send({
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: `Too many sign-in attempts. Try again in ${Math.max(1, Math.ceil(waitSeconds / 60))} minute(s).`,
        },
      });
    }

    const user = await prisma.adminUser.findUnique({ where: { username } });
    // Unknown user and wrong password must be indistinguishable, including in timing.
    const passwordOk = user ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
    if (!user) await dummyPasswordCheck();

    if (!user || !passwordOk || user.disabled) {
      registerLoginFailure(username, ip);
      req.log.warn({ username, ip, reason: !user ? 'unknown_user' : !passwordOk ? 'bad_password' : 'disabled' }, 'Admin sign-in rejected');
      return reply.code(401).send({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' },
      });
    }

    clearLoginFailures(username, ip);
    await purgeExpiredSessions().catch(() => {});
    const { token, expiresAt } = await createAdminSession(user.id, {
      userAgent: (req.headers['user-agent'] as string) ?? null,
      ip,
    });
    await prisma.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    reply.header('set-cookie', sessionCookieHeader(token, expiresAt));
    req.log.info({ username: user.username, role: user.role }, 'Admin signed in');
    return reply.send({
      data: {
        user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
        expiresAt: expiresAt.toISOString(),
      },
    });
  });

  // ── Sign out (idempotent: a stale cookie is cleared too) ──
  app.post('/api/admin/logout', async (req, reply) => {
    const token = readSessionCookie(req.headers.cookie);
    const destroyed = token ? await destroyAdminSession(token) : false;
    if (destroyed) req.log.info('Admin signed out — session destroyed');
    reply.header('set-cookie', clearedSessionCookieHeader());
    return reply.send({ data: { signedOut: true, sessionDestroyed: destroyed } });
  });

  // ── Who am I? (the gate calls this before rendering any CMS code) ──
  app.get('/api/admin/session', async (req, reply) => {
    const auth = req.adminAuth ?? null;
    if (!auth) {
      return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } });
    }
    if (auth.method !== 'session') {
      // The legacy token (or the localhost development bypass) carries no account.
      return {
        data: { authenticated: true, method: auth.method, user: null, username: adminUsername(req), expiresAt: null },
      };
    }
    const session = await prisma.adminSession.findUnique({ where: { id: auth.sessionId } });
    const user = await prisma.adminUser.findUnique({ where: { id: auth.userId } });
    if (!session || !user) {
      return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Session no longer exists.' } });
    }
    return {
      data: {
        authenticated: true,
        method: 'session' as const,
        user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
        username: user.username,
        expiresAt: session.expiresAt.toISOString(),
      },
    };
  });
}
