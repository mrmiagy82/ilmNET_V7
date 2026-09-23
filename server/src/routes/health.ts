import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { uploadsHealth } from '../lib/storage';

/**
 * Health endpoint. Reports service + database + upload storage so a deployment can be
 * verified without opening the admin CMS. Returns 503 when the database is unreachable.
 */
export async function healthRoutes(app: FastifyInstance) {
  const handler = async (reply: any) => {
    const storage = uploadsHealth();
    let database: 'up' | 'down' = 'up';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'down';
    }
    const healthy = database === 'up' && storage.writable;
    reply.code(healthy ? 200 : 503);
    return {
      status: healthy ? 'ok' : 'degraded',
      service: 'ilmnet-server',
      version: '1.0.0',
      env: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database,
      storage: {
        dir: storage.dir,
        persistent: storage.custom,
        writable: storage.writable,
        files: storage.files,
        bytes: storage.bytes,
      },
      adminProtection: Boolean(process.env.ADMIN_TOKEN?.trim()),
    };
  };

  app.get('/api/health', async (_req, reply) => handler(reply));
  app.get('/api/v1/health', async (_req, reply) => handler(reply));
}
