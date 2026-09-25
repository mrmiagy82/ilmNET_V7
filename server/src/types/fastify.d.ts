/** Request decoration for admin authentication (Fase 4.5) — filled by the hook in `server.ts`. */
import type { AdminRequestAuth } from '../lib/auth';

declare module 'fastify' {
  interface FastifyRequest {
    adminAuth?: AdminRequestAuth | null;
  }
}
