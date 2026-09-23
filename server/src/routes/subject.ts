import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { createSubjectSchema, updateSubjectSchema } from '../lib/validation';
import { toSlug, uniqueSlug } from '../utils/slug';

export async function subjectRoutes(app: FastifyInstance) {
  // List subjects (public + admin same for now; admin sees all, public filter later)
  app.get('/api/subjects', async () => {
    const subjects = await prisma.subject.findMany({ orderBy: { name: 'asc' } });
    return { data: subjects };
  });
  app.get('/api/v1/subjects', async () => {
    const subjects = await prisma.subject.findMany({ orderBy: { name: 'asc' } });
    return { data: subjects };
  });
  app.get('/api/admin/subjects', async () => {
    const subjects = await prisma.subject.findMany({ orderBy: { updatedAt: 'desc' } });
    return { data: subjects };
  });

  app.get('/api/subjects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const subject = await prisma.subject.findUnique({ where: { id } });
    if (!subject) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Subject not found' } });
    return { data: subject };
  });
  app.get('/api/v1/subjects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const subject = await prisma.subject.findFirst({ where: { OR: [{ id }, { slug: id }] } });
    if (!subject) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Subject not found' } });
    return { data: subject };
  });

  app.post('/api/subjects', async (req, reply) => {
    const parsed = createSubjectSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
    const data = parsed.data;
    let slug = toSlug(data.name);
    // ensure unique
    let attempt = 0;
    while (await prisma.subject.findUnique({ where: { slug } })) {
      attempt++;
      slug = uniqueSlug(data.name, attempt);
    }
    try {
      const subject = await prisma.subject.create({
        data: {
          name: data.name,
          slug,
          group: data.group,
          description: data.description || null,
          accent: data.accent || null,
          status: data.status || 'published',
          metadata: data.metadata as any,
        },
      });
      return reply.code(201).send({ data: subject });
    } catch (e: any) {
      if (e.code === 'P2002') return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Subject slug already exists' } });
      throw e;
    }
  });

  app.post('/api/v1/subjects', async (req, reply) => {
    const parsed = createSubjectSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
    const data = parsed.data;
    let slug = toSlug(data.name);
    let attempt = 0;
    while (await prisma.subject.findUnique({ where: { slug } })) {
      attempt++;
      slug = uniqueSlug(data.name, attempt);
    }
    const subject = await prisma.subject.create({
      data: {
        name: data.name,
        slug,
        group: data.group,
        description: data.description || null,
        accent: data.accent || null,
        status: data.status || 'published',
        metadata: data.metadata as any,
      },
    });
    return reply.code(201).send({ data: subject });
  });

  app.post('/api/admin/subjects', async (req, reply) => {
    const parsed = createSubjectSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
    const data = parsed.data;
    let slug = toSlug(data.name);
    let attempt = 0;
    while (await prisma.subject.findUnique({ where: { slug } })) {
      attempt++;
      slug = uniqueSlug(data.name, attempt);
    }
    const subject = await prisma.subject.create({
      data: {
        name: data.name,
        slug,
        group: data.group,
        description: data.description || null,
        accent: data.accent || null,
        status: data.status || 'published',
        metadata: data.metadata as any,
      },
    });
    return reply.code(201).send({ data: subject });
  });

  // Update
  for (const base of ['/api/subjects/:id', '/api/v1/subjects/:id', '/api/admin/subjects/:id']) {
    app.patch(base, async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = updateSubjectSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
      const existing = await prisma.subject.findFirst({ where: { OR: [{ id }, { slug: id }] } });
      if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Subject not found' } });
      const data: any = { ...parsed.data };
      if (data.name && data.name !== existing.name) {
        let slug = toSlug(data.name);
        let attempt = 0;
        while (await prisma.subject.findFirst({ where: { slug, NOT: { id: existing.id } } })) {
          attempt++;
          slug = uniqueSlug(data.name, attempt);
        }
        data.slug = slug;
      }
      const updated = await prisma.subject.update({ where: { id: existing.id }, data });
      return { data: updated };
    });

    app.delete(base, async (req, reply) => {
      const { id } = req.params as { id: string };
      const existing = await prisma.subject.findFirst({ where: { OR: [{ id }, { slug: id }] } });
      if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Subject not found' } });
      // Prevent delete if linked to contents
      const linked = await prisma.contentSubject.count({ where: { subjectId: existing.id } });
      if (linked > 0) {
        return reply.code(409).send({ error: { code: 'CONFLICT', message: `Subject is linked to ${linked} contents. Unlink first.` } });
      }
      await prisma.subject.delete({ where: { id: existing.id } });
      return { data: { id: existing.id, deleted: true } };
    });
  }
}
