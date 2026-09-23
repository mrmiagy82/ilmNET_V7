import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { createScholarSchema, updateScholarSchema } from '../lib/validation';
import { toSlug, uniqueSlug } from '../utils/slug';

export async function scholarRoutes(app: FastifyInstance) {
  for (const base of ['/api/scholars', '/api/v1/scholars', '/api/admin/scholars']) {
    app.get(base, async () => {
      const scholars = await prisma.scholar.findMany({
        orderBy: { name: 'asc' },
        include: { specialty: true },
      });
      return { data: scholars };
    });
  }

  for (const base of ['/api/scholars/:id', '/api/v1/scholars/:id', '/api/admin/scholars/:id']) {
    app.get(base, async (req, reply) => {
      const { id } = req.params as { id: string };
      const scholar = await prisma.scholar.findFirst({
        where: { OR: [{ id }, { slug: id }] },
        include: { specialty: true, contents: { include: { content: true } } },
      });
      if (!scholar) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Scholar not found' } });
      return { data: scholar };
    });
  }

  for (const base of ['/api/scholars', '/api/v1/scholars', '/api/admin/scholars']) {
    app.post(base, async (req, reply) => {
      const parsed = createScholarSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
      const data = parsed.data;
      let slug = toSlug(data.name);
      let attempt = 0;
      while (await prisma.scholar.findUnique({ where: { slug } })) {
        attempt++;
        slug = uniqueSlug(data.name, attempt);
      }
      // Validate specialtyId exists if provided
      if (data.specialtyId) {
        const exists = await prisma.subject.findUnique({ where: { id: data.specialtyId } });
        if (!exists) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: `specialtyId ${data.specialtyId} does not exist` } });
      }
      // initials fallback
      let initials = data.initials;
      if (!initials && data.name) {
        const parts = data.name.trim().split(/\s+/).filter(Boolean);
        const skip = new Set(['shaykh', 'shaykha', 'dr.', 'dr', 'ustadh', 'ustadha', 'imam']);
        const core = parts.filter((p) => !skip.has(p.toLowerCase()));
        const use = (core.length ? core : parts).slice(0, 2);
        initials = use.map((w) => w[0]!.toUpperCase()).join('');
      }
      const scholar = await prisma.scholar.create({
        data: {
          name: data.name,
          slug,
          initials: initials || null,
          specialtyId: data.specialtyId || null,
          bio: data.bio || null,
          accent: data.accent || null,
          status: data.status || 'published',
          metadata: data.metadata as any,
        },
      });
      return reply.code(201).send({ data: scholar });
    });
  }

  for (const base of ['/api/scholars/:id', '/api/v1/scholars/:id', '/api/admin/scholars/:id']) {
    app.patch(base, async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = updateScholarSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
      const existing = await prisma.scholar.findFirst({ where: { OR: [{ id }, { slug: id }] } });
      if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Scholar not found' } });
      if (parsed.data.specialtyId) {
        const exists = await prisma.subject.findUnique({ where: { id: parsed.data.specialtyId } });
        if (!exists) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: `specialtyId ${parsed.data.specialtyId} does not exist` } });
      }
      const data: any = { ...parsed.data };
      if (data.name && data.name !== existing.name) {
        let slug = toSlug(data.name);
        let attempt = 0;
        while (await prisma.scholar.findFirst({ where: { slug, NOT: { id: existing.id } } })) {
          attempt++;
          slug = uniqueSlug(data.name, attempt);
        }
        data.slug = slug;
        if (!data.initials) {
          const parts = data.name.trim().split(/\s+/).filter(Boolean);
          const skip = new Set(['shaykh', 'shaykha', 'dr.', 'dr', 'ustadh', 'ustadha', 'imam']);
          const core = parts.filter((p: string) => !skip.has(p.toLowerCase()));
          const use = (core.length ? core : parts).slice(0, 2);
          data.initials = use.map((w: string) => w[0]!.toUpperCase()).join('');
        }
      }
      const updated = await prisma.scholar.update({ where: { id: existing.id }, data });
      return { data: updated };
    });

    app.delete(base, async (req, reply) => {
      const { id } = req.params as { id: string };
      const existing = await prisma.scholar.findFirst({ where: { OR: [{ id }, { slug: id }] } });
      if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Scholar not found' } });
      const linked = await prisma.contentScholar.count({ where: { scholarId: existing.id } });
      if (linked > 0) {
        return reply.code(409).send({ error: { code: 'CONFLICT', message: `Scholar is linked to ${linked} contents. Unlink first.` } });
      }
      await prisma.scholar.delete({ where: { id: existing.id } });
      return { data: { id: existing.id, deleted: true } };
    });
  }
}
