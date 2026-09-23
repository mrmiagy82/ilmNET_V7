import { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      service: 'ilmnet-server',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // Also support /api/v1/health
  app.get('/api/v1/health', async () => {
    return {
      status: 'ok',
      service: 'ilmnet-server',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  });
}
