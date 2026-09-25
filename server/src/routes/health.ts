import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { uploadsHealth } from '../lib/storage';
import { adminAuthPosture } from '../lib/env';
import { releaseInfo } from '../lib/release';

/**
 * Health and readiness endpoints.
 *
 *   GET /api/health  (alias: /api/v1/health)
 *     The deep check: service + database + upload storage. Returns **503** when the database is
 *     unreachable or the upload volume is not writable. This is what the Dockerfile HEALTHCHECK and
 *     the deployment runbook use: it tells an operator whether the whole deployment is usable
 *     (uploads are how the CMS attaches thumbnails/covers).
 *
 *   GET /api/ready   (alias: /api/v1/ready)
 *     The cheap readiness probe for a load balancer / orchestrator: it only pings the database, so a
 *     pod can be taken out of rotation without waiting for the storage walk. Returns **200** with
 *     `{ status: "ready", database: "up" }` or **503** with `{ status: "not_ready", database: "down" }`.
 *
 *   Both are public (no admin credentials), read-only, and deliberately exempt from the
 *   `FORCE_HTTPS` redirect so a probe on the app socket keeps working over plain HTTP (Fase 5.2).
 *
 *   Fase 5.6: the deep check also reports the release it is running (`version` from
 *   `server/package.json`, `commit` from `GIT_COMMIT` when the host sets it) and how long the process
 *   has been up, so a deploy or a rollback can be verified against the thing that answers — instead of
 *   assuming the right build is live. Still no host paths, no configuration values and no secrets.
 */
export async function healthRoutes(app: FastifyInstance) {
  const deepHandler = async (reply: any) => {
    const storage = uploadsHealth();
    let database: 'up' | 'down' = 'up';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    const healthy = database === 'up' && storage.writable;
    const release = releaseInfo();
    reply.code(healthy ? 200 : 503);
    return {
      status: healthy ? 'ok' : 'degraded',
      service: 'ilmnet-server',
      // Fase 5.6: the real version from server/package.json, plus the commit the host deployed.
      version: release.version,
      commit: release.commit,
      env: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database,
      storage: {
        // Fase 5.3: the absolute directory is deliberately not published — this endpoint is public
        // and a probe only needs to know whether uploads work (writable) and on which volume
        // (persistent), not where the host keeps its files.
        persistent: storage.custom,
        writable: storage.writable,
        files: storage.files,
        bytes: storage.bytes,
      },
      // Honest, non-secret posture (Fase 5.3): `sessions` or `sessions+legacy-token`.
      adminProtection: adminAuthPosture(),
    };
  };

  const readyHandler = async (reply: any) => {
    let database: 'up' | 'down' = 'up';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    const ready = database === 'up';
    reply.code(ready ? 200 : 503);
    return {
      status: ready ? 'ready' : 'not_ready',
      service: 'ilmnet-server',
      database,
      timestamp: new Date().toISOString(),
    };
  };

  app.get('/api/health', async (_req, reply) => deepHandler(reply));
  app.get('/api/v1/health', async (_req, reply) => deepHandler(reply));
  app.get('/api/ready', async (_req, reply) => readyHandler(reply));
  app.get('/api/v1/ready', async (_req, reply) => readyHandler(reply));
}
