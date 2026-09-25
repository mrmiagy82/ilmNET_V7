import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { adminUsername } from '../lib/auth';
import { createSubjectSchema, updateSubjectSchema } from '../lib/validation';
import { toSlug, uniqueSlug } from '../utils/slug';
import { publicList, publicSubject } from '../lib/public-payload';

/**
 * Subjects (shelves). Public reads only ever return published subjects and accept
 * either the id or the slug; every write lives under /api/admin and is protected by
 * the admin token hook in server.ts.
 */
export async function subjectRoutes(app: FastifyInstance) {
  // ── Public reads (published only, id or slug) ──
  for (const base of ['/api/subjects', '/api/v1/subjects']) {
    app.get(base, async () => {
      const subjects = await prisma.subject.findMany({ where: { status: 'published' }, orderBy: { name: 'asc' } });
      // Fase 5.3 (audit I8): positive-list payload — `metadata` (operator-extensible) stays private.
      return { data: publicList(subjects, publicSubject) };
    });
  }
  for (const base of ['/api/subjects/:id', '/api/v1/subjects/:id']) {
    app.get(base, async (req, reply) => {
      const { id } = req.params as { id: string };
      const subject = await prisma.subject.findFirst({
        where: { status: 'published', OR: [{ id }, { slug: id }] },
      });
      if (!subject) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Subject not found' } });
      return { data: publicSubject(subject) };
    });
  }

  // ── Admin reads (all statuses) ──
  app.get('/api/admin/subjects', async () => {
    const subjects = await prisma.subject.findMany({ orderBy: { updatedAt: 'desc' } });
    return { data: subjects };
  });
  app.get('/api/admin/subjects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const subject = await prisma.subject.findFirst({ where: { OR: [{ id }, { slug: id }] } });
    if (!subject) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Subject not found' } });
    return { data: subject };
  });

  // ── Create ──
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
      if (e.code === 'P2002') return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Subject name or slug already exists' } });
      throw e;
    }
  });

  // ── Update ──
  app.patch('/api/admin/subjects/:id', async (req, reply) => {
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
    try {
      const updated = await prisma.subject.update({ where: { id: existing.id }, data });
      return { data: updated };
    } catch (e: any) {
      if (e.code === 'P2002') return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Subject name or slug already exists' } });
      throw e;
    }
  });

  // ── Delete (refuses while still linked to content) ──
  app.delete('/api/admin/subjects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { confirm } = req.query as { confirm?: string };
    const existing = await prisma.subject.findFirst({ where: { OR: [{ id }, { slug: id }] } });
    if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Subject not found' } });
    const linked = await prisma.contentSubject.count({ where: { subjectId: existing.id } });
    if (linked > 0) {
      return reply.code(409).send({ error: { code: 'CONFLICT', message: `Subject is linked to ${linked} contents. Unlink first.` } });
    }
    // Fase 5.3 (audit I7): deleting a shelf is irreversible — require the record to be named.
    const supplied = (confirm ?? '').trim();
    if (supplied !== existing.id && supplied !== existing.slug) {
      return reply.code(400).send({
        error: {
          code: 'CONFIRM_REQUIRED',
          message: `Removing “${existing.name}” cannot be undone. Repeat the id or slug in ?confirm=<id|slug> to proceed.`,
        },
      });
    }
    await prisma.subject.delete({ where: { id: existing.id } });
    req.log.warn({ operator: adminUsername(req), id: existing.id, slug: existing.slug }, 'Subject deleted');
    return { data: { id: existing.id, deleted: true } };
  });
}
