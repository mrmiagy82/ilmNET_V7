import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import sensible from '@fastify/sensible';
import fastifyStatic from '@fastify/static';
// Imported before ./lib/prisma on purpose: the snapshot of the real process environment has to be
// taken before Prisma/dotenv can load a .env file (Fase 3.8.1).
import { assertAdminAccessPossible, assertBootConfiguration, adminAuthPosture, isProduction, legacyAdminTokenEnabled } from './lib/env';
import { prisma } from './lib/prisma';
import { healthRoutes } from './routes/health';
import { contentRoutes } from './routes/content';
import { scholarRoutes } from './routes/scholar';
import { subjectRoutes } from './routes/subject';
import { importRoutes } from './routes/import';
import { uploadRoutes } from './routes/uploads';
import { authRoutes } from './routes/auth';
import {
  clearedSessionCookieHeader,
  readSessionCookie,
  resolveAdminSession,
  touchAdminSession,
} from './lib/auth';
import { auditUploadReferences, ensureUploadsDir, getUploadsDir, isUploadsDirWritable, MAX_UPLOAD_BYTES } from './lib/storage';
import {
  assertProxyConfiguration,
  forwardedHost,
  redirectTargetFor,
  trustProxyDescription,
  trustProxyIsEnabled,
  trustProxySetting,
} from './lib/proxy';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
/**
 * `isProduction()` comes from ./lib/env and is evaluated at call time (not at import), so a process
 * can be started with NODE_ENV=production and tests can exercise production behaviour.
 */
const adminToken = () => process.env.ADMIN_TOKEN?.trim() || '';

/** Comma separated list of allowed browser origins. Dev defaults to the vite dev server. */
function corsOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN?.trim() || 'http://localhost:5173';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * HSTS max-age in seconds (Fase 5.1). Default one year; `HSTS_MAX_AGE=0` switches the header off.
 * The header is only sent on requests that really arrived over HTTPS (see the onSend hook).
 */
function hstsMaxAge(): number {
  const fallback = 60 * 60 * 24 * 365;
  const raw = process.env.HSTS_MAX_AGE?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

/**
 * Opt-in HTTP → HTTPS redirect (Fase 5.1). Enable with `FORCE_HTTPS=true` in production when a
 * TLS-terminating reverse proxy forwards the original scheme in `x-forwarded-proto`; the proxy must
 * set that header, otherwise this can only ever see `http` and would redirect in a loop — hence the
 * boot guard in `lib/proxy.ts` (`assertProxyConfiguration`).
 *
 * The redirect target is never taken from the request unless the host is allowlisted: see
 * `redirectTargetFor()` — `PUBLIC_ORIGIN` wins, otherwise a host from `CORS_ORIGIN`/`ALLOWED_HOSTS`.
 */
function forceHttpsEnabled(): boolean {
  return isProduction() && process.env.FORCE_HTTPS?.trim().toLowerCase() === 'true';
}

/** Constant-time token comparison so the admin token cannot be probed byte by byte. */
function tokenMatches(provided: string): boolean {
  if (!provided) return false;
  const expected = adminToken();
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Location + availability of the built frontend (single-file vite build). */
function frontendBuild() {
  const dir = path.resolve(process.env.FRONTEND_DIR?.trim() || path.join(__dirname, '..', '..', 'dist'));
  const index = path.join(dir, 'index.html');
  return { dir, index, available: fs.existsSync(index) };
}

export async function buildApp() {
  // ── Production guard rails: never boot a public deployment without admin protection ──
  // Fase 3.8.1: refuses a production boot configured by a local .env file, an undeclared mode on a
  // host that carries deployment config, and development/placeholder admin tokens.
  assertBootConfiguration();
  // Fase 5.3 (audit I6): in production the legacy shared token is off unless a host opts in with
  // `ADMIN_LEGACY_TOKEN=true`. When it is on, the token is the only way in for scripts and must meet
  // the production rules; when it is off, an unused ADMIN_TOKEN is a lingering secret — say so.
  if (isProduction()) {
    if (legacyAdminTokenEnabled() && !adminToken()) {
      throw new Error(
        'ADMIN_LEGACY_TOKEN=true is set, but ADMIN_TOKEN is missing: the legacy token would authenticate nobody. ' +
          'Provide a production-grade ADMIN_TOKEN (openssl rand -hex 32) or remove ADMIN_LEGACY_TOKEN to run sessions-only.',
      );
    }
    if (!legacyAdminTokenEnabled() && adminToken()) {
      // eslint-disable-next-line no-console
      console.warn(
        '[ilmNet] ADMIN_TOKEN is set but the legacy token path is disabled in production (Fase 5.3). ' +
          'Remove it from the service environment, or set ADMIN_LEGACY_TOKEN=true if a script really needs it.',
      );
    }
  }
  // Fase 5.2 — a redirect without a trusted proxy would loop, and a redirect without an allowlisted
  // host would let the request decide where visitors are sent.
  assertProxyConfiguration();
  if (corsOrigins().includes('*')) {
    if (isProduction()) throw new Error('CORS_ORIGIN="*" is not allowed in production — list the exact frontend origins.');
    // eslint-disable-next-line no-console
    console.warn('[ilmNet] CORS_ORIGIN="*" — fine for local tooling, never use this in production.');
  }

  const app = Fastify({
    logger: {
      level: isProduction() ? 'info' : 'debug',
      // never log request bodies (they can contain admin payloads) and redact auth headers
      redact: ['req.headers["x-admin-token"]', 'req.headers.authorization', 'req.headers["x-admin-secret"]'],
    },
    bodyLimit: 1 * 1024 * 1024, // 1 MB JSON payloads; uploads go through multipart
    // Fase 5.2: forwarded headers (x-forwarded-for / -proto / -host) are only honoured when
    // TRUST_PROXY says which proxy may be trusted. `true` (the pre-5.2 behaviour) is an explicit
    // opt-in, never the default: a spoofable client IP feeds the login throttle and the logs, and a
    // spoofable x-forwarded-host feeds the redirect below.
    trustProxy: trustProxySetting(),
  });

  await app.register(cors, {
    origin: corsOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  await app.register(sensible);

  // ── Security headers (no framing rules: the site is embedded in previews/iframes) ──
  app.addHook('onSend', async (req, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    // YouTube requires the Referer for embedded players (Fase 4.3.1): never weaken this value.
    reply.header('referrer-policy', 'strict-origin-when-cross-origin');
    reply.header('x-permitted-cross-domain-policies', 'none');
    // HSTS (Fase 5.1) — only on a request that really arrived over HTTPS: direct TLS or a proxy
    // that sets `x-forwarded-proto` (trustProxy). Over plain HTTP a browser ignores it anyway, so
    // sending it would only be misleading. `includeSubDomains`/`preload` are deliberately NOT set:
    // add them at the proxy once every subdomain is HTTPS-only.
    const hsts = hstsMaxAge();
    if (hsts > 0 && req.protocol === 'https') {
      reply.header('strict-transport-security', `max-age=${hsts}`);
    }
    return payload;
  });

  // ── HTTP → HTTPS (opt-in, provider-agnostic) ──
  // With FORCE_HTTPS=true (production only) every plain-HTTP request is answered with a 308 to the
  // same URL over HTTPS — 308 keeps the method and body, so an admin POST is not turned into a GET.
  // Health endpoints are exempt so a container/orchestrator that talks to the app socket over HTTP
  // (server/Dockerfile HEALTHCHECK) keeps working. The proxy normally does this redirect; this is
  // the in-app fallback for a proxy that only forwards.
  if (forceHttpsEnabled()) {
    let warnedAboutHost = false;
    app.addHook('onRequest', async (req, reply) => {
      if (req.protocol === 'https') return;
      const path = req.url.split('?')[0];
      if (path === '/api/health' || path === '/api/v1/health' || path === '/api/ready' || path === '/api/v1/ready') {
        return; // probes must keep working over plain HTTP on the app socket (Docker HEALTHCHECK)
      }
      // Only a host that is on the allowlist (PUBLIC_ORIGIN / CORS_ORIGIN / ALLOWED_HOSTS) can be
      // the target; anything else falls back to the canonical host instead of being echoed back.
      const claimedHost = forwardedHost(req) ?? (req.headers.host as string | undefined);
      const target = redirectTargetFor(claimedHost);
      if (!target) {
        if (!warnedAboutHost) {
          warnedAboutHost = true;
          req.log.error(
            'FORCE_HTTPS is on but no redirect target is configured (PUBLIC_ORIGIN / CORS_ORIGIN / ALLOWED_HOSTS). ' +
              'Requests are served as-is; let the reverse proxy do the HTTP→HTTPS redirect.',
          );
        }
        return;
      }
      if (target.replacedHost) {
        req.log.warn(
          { claimedHost: target.replacedHost, redirectTo: target.origin },
          'Refused to redirect to a host that is not on the allowlist — using the canonical origin',
        );
      }
      return reply.code(308).redirect(`${target.origin}${req.raw.url ?? req.url}`);
    });
  }

  // ── Admin protection (Fase 4.5, tightened in 5.3) ──
  // Every write under /api/* and every request under /api/admin/* (including reads of drafts,
  // import jobs and uploads) requires an authenticated operator. The order is:
  //   1. a valid **session cookie** (username/password sign-in) — carries an identity,
  //   2. the legacy **ADMIN_TOKEN** header/bearer — only while `ADMIN_LEGACY_TOKEN` leaves it
  //      enabled (development by default, production only by explicit opt-in; audit I6),
  //   3. the localhost development bypass (non-production only; `ADMIN_ALLOW_LOCALHOST=false` off).
  // `/api/admin/login` and `/api/admin/logout` are reachable without credentials by design.
  app.decorateRequest('adminAuth', null);
  const publicAdminPaths = new Set(['/api/admin/login', '/api/admin/logout']);
  app.addHook('onRequest', async (req, reply) => {
    const url = req.url.split('?')[0];
    const method = req.method.toUpperCase();
    const isWrite = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);
    const isAdminPath = url.startsWith('/api/admin/') || url === '/api/admin';
    if (!isWrite && !isAdminPath) return;
    if (!url.startsWith('/api/')) return;
    if (publicAdminPaths.has(url)) return;

    // Local development convenience: same-machine requests (vite proxy, curl, tests)
    if (!isProduction() && process.env.ADMIN_ALLOW_LOCALHOST !== 'false') {
      const ip = (req.ip || '').toString();
      const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || req.headers.host?.includes('localhost');
      if (isLocal) {
        req.adminAuth = { method: 'localhost', username: null, userId: null, sessionId: null };
        return;
      }
    }

    // 1) Session cookie
    const sessionToken = readSessionCookie(req.headers.cookie);
    if (sessionToken) {
      const session = await resolveAdminSession(sessionToken);
      if (session) {
        req.adminAuth = {
          method: 'session',
          username: session.user.username,
          userId: session.user.id,
          sessionId: session.sessionId,
        };
        await touchAdminSession(session);
        return;
      }
      // Expired/unknown/tampered cookie: drop it so the browser stops sending a dead session.
      reply.header('set-cookie', clearedSessionCookieHeader());
    }

    // 2) Legacy shared token (no identity attached). Fase 5.3: only while it is switched on, so a
    //    production deployment that runs on accounts cannot be opened with a leaked string.
    if (legacyAdminTokenEnabled()) {
      const headerToken = (req.headers['x-admin-token'] as string) || (req.headers['x-admin-secret'] as string) || '';
      const auth = (req.headers['authorization'] as string) || '';
      const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (adminToken() && tokenMatches(headerToken || bearer)) {
        req.adminAuth = { method: 'token', username: null, userId: null, sessionId: null };
        return;
      }
    }

    return reply.code(401).send({
      error: { code: 'UNAUTHORIZED', message: 'Sign in to the admin CMS, or provide a valid admin token.' },
    });
  });

  // ── Static uploads (custom thumbnails/covers) ──
  ensureUploadsDir();
  await app.register(multipart, { limits: { fileSize: MAX_UPLOAD_BYTES } });
  await app.register(fastifyStatic, {
    root: getUploadsDir(),
    prefix: '/uploads/',
    decorateReply: false,
    index: false,
    maxAge: isProduction() ? '7d' : 0,
  });

  // ── Optional frontend hosting: serve the built single-file SPA from Fastify ──
  // Set SERVE_FRONTEND=false to host the frontend separately (then set VITE_API_URL).
  const { dir: frontendDir, available: buildExists } = frontendBuild();
  const serveFrontend = process.env.SERVE_FRONTEND !== 'false' && buildExists;
  if (serveFrontend) {
    await app.register(fastifyStatic, {
      root: frontendDir,
      prefix: '/',
      // Fase 5.4: `decorateReply` gives us `reply.sendFile` for the SPA fallback below, so a deep
      // link is served by the static handler (async, ETag/Last-Modified, pre-compressed variant)
      // instead of a synchronous read of the whole bundle on every request.
      decorateReply: true,
      index: 'index.html', // GET / serves the built app; deep links fall through to the SPA fallback
      wildcard: true,
      // The single-file build inlines the whole app into index.html (~646 kB). `npm run build`
      // writes index.html.gz next to it; when the client sends `accept-encoding: gzip` this is what
      // goes over the wire (~161 kB). No dependency: the file is produced by scripts/precompress.mjs.
      preCompressed: true,
    });
  }

  // Global error handler for validation
  app.setErrorHandler((error: any, _req, reply) => {
    if ((error as any).validation) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: error.message, details: (error as any).validation },
      });
    }
    if (error?.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return reply.code(error.statusCode).send({ error: { code: error.code || 'BAD_REQUEST', message: error.message } });
    }
    app.log.error(error);
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } });
  });

  await app.register(authRoutes);
  await app.register(healthRoutes);
  await app.register(contentRoutes);
  await app.register(scholarRoutes);
  await app.register(subjectRoutes);
  await app.register(importRoutes);
  await app.register(uploadRoutes);

  // 404 — JSON for the API, index.html for browser routes (hash router + deep links)
  app.setNotFoundHandler((req, reply) => {
    const url = req.url.split('?')[0];
    if (serveFrontend && req.method === 'GET' && !url.startsWith('/api/') && !url.startsWith('/uploads/')) {
      // Fase 5.4: SPA fallback through the static handler — no blocking read of the whole bundle per
      // request, and the pre-compressed index.html.gz is used when the client supports gzip.
      // `index.html` is only touched when the build did not produce a gzip variant.
      return reply.type('text/html').sendFile('index.html');
    }
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.url} not found` } });
  });

  return app;
}

if (require.main === module) {
  (async () => {
    const app = await buildApp();
    try {
      await prisma.$connect();
      app.log.info('Database connected');

      // Fase 5.3 (audit I6): with the legacy token switched off, at least one active operator
      // account must exist — otherwise nobody could ever sign in to this deployment.
      const activeAccounts = await prisma.adminUser.count({ where: { disabled: false } });
      assertAdminAccessPossible({ mode: isProduction() ? 'production' : 'development', legacyTokenEnabled: legacyAdminTokenEnabled(), activeAccounts });

      if (!isUploadsDirWritable()) {
        app.log.error(`Uploads directory is not writable: ${getUploadsDir()} — custom thumbnails/cover uploads will fail.`);
      } else {
        const audit = await auditUploadReferences(prisma as any);
        app.log.info(
          `Upload storage ready at ${getUploadsDir()} (mode: ${process.env.UPLOADS_DIR ? 'UPLOADS_DIR' : 'default'}) — ` +
            `${audit.referenced} referenced file(s), ${audit.orphan} unused on disk.`,
        );
        if (audit.missing.length) {
          app.log.warn(
            `Missing upload file(s) referenced by the database: ${audit.missing.slice(0, 5).join(', ')}` +
              `${audit.missing.length > 5 ? ` (+${audit.missing.length - 5} more)` : ''} — mount the uploads volume or re-upload.`,
          );
        }
      }

      await app.listen({ port: PORT, host: HOST });
      app.log.info(`Server listening on http://${HOST}:${PORT} [${isProduction() ? 'production' : 'development'}]`);
      app.log.info(`CORS origins: ${corsOrigins().join(', ')}`);
      app.log.info(
        `Admin protection: session sign-in enabled (${activeAccounts} active account${activeAccounts === 1 ? '' : 's'})` +
          (legacyAdminTokenEnabled()
            ? ` + legacy ADMIN_TOKEN fallback${adminToken() ? '' : ' (no token set — inactive)'}`
            : ' · legacy ADMIN_TOKEN disabled'),
      );
      app.log.info(
        `TLS: ${hstsMaxAge() > 0 ? `HSTS max-age=${hstsMaxAge()}s on https requests` : 'HSTS disabled (HSTS_MAX_AGE=0)'}` +
          ` · HTTP→HTTPS redirect: ${forceHttpsEnabled() ? `on (FORCE_HTTPS) → ${redirectTargetFor(null)?.origin ?? 'no target configured'}` : 'off (let the reverse proxy do it)'}`,
      );
      app.log.info(`Proxy trust: TRUST_PROXY ${trustProxyDescription()}`);
      if (isProduction() && !trustProxyIsEnabled()) {
        app.log.info(
          'Client IP source: the socket address. Behind a reverse proxy every request therefore looks like ' +
            'the proxy itself (login throttle and admin sessions record that address) — set TRUST_PROXY to the ' +
            'proxy address/CIDR, or true when the API is only reachable through the proxy.',
        );
      }
      const build = frontendBuild();
      app.log.info(
        `Serving frontend build: ${build.available && process.env.SERVE_FRONTEND !== 'false' ? build.dir : 'no (API only — set VITE_API_URL on the frontend host)'}`,
      );
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }

    const signals = ['SIGINT', 'SIGTERM'] as const;
    for (const sig of signals) {
      process.on(sig, async () => {
        app.log.info(`Received ${sig}, shutting down...`);
        await app.close();
        await prisma.$disconnect();
        process.exit(0);
      });
    }
  })();
}
