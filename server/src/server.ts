import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import sensible from '@fastify/sensible';
import fastifyStatic from '@fastify/static';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma';
import { healthRoutes } from './routes/health';
import { contentRoutes } from './routes/content';
import { scholarRoutes } from './routes/scholar';
import { subjectRoutes } from './routes/subject';
import { importRoutes } from './routes/import';
import { uploadRoutes, UPLOADS_DIR } from './routes/uploads';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  await app.register(cors, {
    origin: CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true,
  });

  await app.register(sensible);

  // Custom admin uploads (thumbnails / covers) — multipart + static serving
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
  await app.register(fastifyStatic, {
    root: UPLOADS_DIR,
    prefix: '/uploads/',
    decorateReply: false,
  });

  // Minimal admin write protection: if ADMIN_TOKEN is set, require x-admin-token for POST/PATCH/DELETE on /api/admin/*
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN?.trim() || '';
  if (ADMIN_TOKEN) {
    app.addHook('onRequest', async (req, reply) => {
      const url = req.url;
      const method = req.method;
      const isAdminWrite = url.startsWith('/api/admin/') && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);
      if (!isAdminWrite) return;
      // In development allow localhost without token for tests and local vite proxy
      if (process.env.NODE_ENV !== 'production') {
        // Check if request is from localhost (dev) — allow but log
        const ip = (req.ip || '').toString();
        const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || req.headers.host?.includes('localhost');
        // Still require token for non-local in dev, but allow local to ease testing
        // For explicit token check, allow local without token
        if (isLocal) return;
      }
      const token = (req.headers['x-admin-token'] as string) || (req.headers['x-admin-secret'] as string) || '';
      const auth = (req.headers['authorization'] as string) || '';
      const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      const provided = token || bearer;
      if (provided !== ADMIN_TOKEN) {
        return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid admin token' } });
      }
    });
  }

  // Global error handler for validation
  app.setErrorHandler((error: any, _req, reply) => {
    if ((error as any).validation) {
      return reply.code(400).send({
        error: { code: 'VALIDATION_ERROR', message: error.message, details: (error as any).validation },
      });
    }
    app.log.error(error);
    return reply.code(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Internal Server Error' } });
  });

  await app.register(healthRoutes);
  await app.register(contentRoutes);
  await app.register(scholarRoutes);
  await app.register(subjectRoutes);
  await app.register(importRoutes);
  await app.register(uploadRoutes);

  // 404
  app.setNotFoundHandler((req, reply) => {
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
      await app.listen({ port: PORT, host: HOST });
      app.log.info(`Server listening on http://${HOST}:${PORT}`);
      app.log.info(`Health: http://${HOST}:${PORT}/api/health`);
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
