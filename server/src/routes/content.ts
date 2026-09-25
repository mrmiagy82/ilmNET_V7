import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { adminUsername } from '../lib/auth';
import {
  createContentSchema,
  listContentQuerySchema,
  normalizeProvider,
  updateContentSchema,
} from '../lib/validation';
import { toSlug, uniqueSlug } from '../utils/slug';
import { publicContent, publicContentList, publicList } from '../lib/public-payload';

function buildEmbedUrl(provider: string, sourceUrl: string, externalIdentifier?: string | null): string | null {
  const norm = normalizeProvider(provider);
  if (norm === 'youtube') {
    try {
      const u = new URL(sourceUrl);
      const host = u.hostname.replace(/^www\./, '');
      const v = u.searchParams.get('v');
      const list = u.searchParams.get('list');
      if (host === 'youtu.be') {
        const id = u.pathname.slice(1).split('/')[0];
        if (id && list) return `https://www.youtube.com/embed/${id}?list=${list}`;
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      if (u.pathname.startsWith('/embed/')) return sourceUrl;
      if (u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/')[2];
        return `https://www.youtube.com/embed/${id}`;
      }
      if (u.pathname.includes('/playlist') && list && !v) return `https://www.youtube.com/embed/videoseries?list=${list}`;
      if (v) {
        if (list) return `https://www.youtube.com/embed/${v}?list=${list}`;
        return `https://www.youtube.com/embed/${v}`;
      }
      if (list) return `https://www.youtube.com/embed/videoseries?list=${list}`;
      return null;
    } catch {
      return null;
    }
  }
  if (norm === 'archive') {
    try {
      const u = new URL(sourceUrl);
      const parts = u.pathname.split('/').filter(Boolean);
      const idx = parts.indexOf('details');
      if (idx !== -1 && parts[idx + 1]) return `https://archive.org/embed/${parts[idx + 1]}`;
      if (parts[0] === 'embed') return sourceUrl;
      if (parts.length === 1) return `https://archive.org/embed/${parts[0]}`;
      if (externalIdentifier) return `https://archive.org/embed/${externalIdentifier}`;
      return null;
    } catch {
      return null;
    }
  }
  if (norm === 'google_books') {
    try {
      const u = new URL(sourceUrl);
      const id = u.searchParams.get('id');
      if (id) return `https://books.google.com/books?id=${id}&printsec=frontcover&hl=en`;
      return null;
    } catch {
      return null;
    }
  }
  if (norm === 'pdf') return sourceUrl;
  return null;
}

function parseListParam(v?: string): string[] | undefined {
  if (!v) return undefined;
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function contentRoutes(app: FastifyInstance) {
  // Helper to build where for list
  async function handleList(req: any, reply: any, forcedStatus?: string) {
    const parsed = listContentQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
    }
    const { page, limit, q, sort, scholar, subject, language, collection } = parsed.data;
    let { status, type, provider } = parsed.data as any;

    if (forcedStatus) status = forcedStatus;

    const where: any = {};

    if (status) {
      const statuses = parseListParam(status);
      if (statuses && statuses.length) where.status = statuses.length === 1 ? statuses[0] : { in: statuses };
    } else if (forcedStatus) {
      where.status = forcedStatus;
    }

    if (type) {
      const types = parseListParam(type);
      if (types && types.length) where.type = types.length === 1 ? types[0] : { in: types };
    }

    if (provider) {
      const providers = parseListParam(provider)!.map(normalizeProvider);
      where.provider = providers.length === 1 ? providers[0] : { in: providers };
    }

    if (language) {
      where.language = language;
    }

    // Fase 5.4: exact series/collection filter (indexed column). The public series page and the
    // "more from this collection" block on a detail page used `q=<collectionIdentifier>` — an
    // ILIKE over nine columns that could not use an index and also matched *other* collections whose
    // identifier merely starts with the same text. Equality is both correct and index-backed.
    if (collection) {
      where.collectionIdentifier = collection;
    }

    if (q) {
      const qq = q.trim();
      if (qq) {
        where.OR = [
          { title: { contains: qq, mode: 'insensitive' } },
          { description: { contains: qq, mode: 'insensitive' } },
          { slug: { contains: qq, mode: 'insensitive' } },
          { collectionTitle: { contains: qq, mode: 'insensitive' } },
          { collectionIdentifier: { contains: qq, mode: 'insensitive' } },
          { series: { contains: qq, mode: 'insensitive' } },
          { language: { contains: qq, mode: 'insensitive' } },
          { scholars: { some: { scholar: { name: { contains: qq, mode: 'insensitive' } } } } },
          { subjects: { some: { subject: { name: { contains: qq, mode: 'insensitive' } } } } },
        ];
      }
    }

    if (scholar) {
      const vals = parseListParam(scholar)!;
      if (vals.length) {
        where.scholars = {
          some: {
            OR: [{ scholarId: { in: vals } }, { scholar: { slug: { in: vals } } }, { scholar: { name: { in: vals } } }],
          },
        };
      }
    }

    if (subject) {
      const vals = parseListParam(subject)!;
      if (vals.length) {
        where.subjects = {
          some: {
            OR: [{ subjectId: { in: vals } }, { subject: { slug: { in: vals } } }, { subject: { name: { in: vals } } }],
          },
        };
      }
    }

    let orderBy: any = { updatedAt: 'desc' };
    if (sort) {
      const [field, dir] = sort.split(':');
      const allowed = ['createdAt', 'updatedAt', 'publishedAt', 'title', 'year'];
      if (field && allowed.includes(field)) {
        orderBy = { [field]: dir === 'asc' ? 'asc' : 'desc' };
      }
    }

    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      prisma.content.count({ where }),
      prisma.content.findMany({
        where,
        include: {
          scholars: { include: { scholar: true } },
          subjects: { include: { subject: true } },
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    // Fase 5.3 (audit I8): the public endpoints get the positive-list payload — never the raw row
    // with operator attribution (`createdBy`/`updatedBy`) or import bookkeeping (`importJobId`).
    // The admin list keeps the full row because the CMS shows attribution.
    // Fase 5.4: a *list* response uses the reduced projection (media keys of `metadata`, card-shaped
    // join rows) — the keys are identical, only the nested data is smaller.
    const isPublic = forcedStatus === 'published';

    return {
      data: isPublic ? publicList(data, publicContentList) : data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // — Public list (only published) —
  app.get('/api/contents', async (req, reply) => handleList(req, reply, 'published'));
  app.get('/api/v1/contents', async (req, reply) => handleList(req, reply, 'published'));
  // Admin list (all statuses, with filters)
  app.get('/api/admin/contents', async (req, reply) => handleList(req, reply));

  // — Public detail (only published, by id or slug) —
  for (const base of ['/api/contents/:id', '/api/v1/contents/:id']) {
    app.get(base, async (req, reply) => {
      const { id } = req.params as { id: string };
      const content = await prisma.content.findFirst({
        where: {
          OR: [{ id }, { slug: id }],
          status: 'published',
        },
        include: { scholars: { include: { scholar: true } }, subjects: { include: { subject: true } } },
      });
      if (!content) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Content not found' } });
      return { data: publicContent(content) };
    });
  }

  // Admin detail (any status)
  app.get('/api/admin/contents/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const content = await prisma.content.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: { scholars: { include: { scholar: true } }, subjects: { include: { subject: true } } },
    });
    if (!content) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Content not found' } });
    return { data: content };
  });

  // — Create (admin) —
  for (const base of ['/api/admin/contents']) {
    app.post(base, async (req, reply) => {
      const parsed = createContentSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
      }
      const data = parsed.data as any;
      data.provider = normalizeProvider(data.provider);

      // Validate scholarIds / subjectIds exist
      if (data.scholarIds?.length) {
        const count = await prisma.scholar.count({ where: { id: { in: data.scholarIds } } });
        if (count !== data.scholarIds.length) {
          return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'One or more scholarIds do not exist' } });
        }
      }
      if (data.subjectIds?.length) {
        const count = await prisma.subject.count({ where: { id: { in: data.subjectIds } } });
        if (count !== data.subjectIds.length) {
          return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'One or more subjectIds do not exist' } });
        }
      }

      let slug = toSlug(data.title);
      let attempt = 0;
      while (await prisma.content.findUnique({ where: { slug } })) {
        attempt++;
        slug = uniqueSlug(data.title, attempt);
      }

      const embedUrl = data.embedUrl || buildEmbedUrl(data.provider, data.sourceUrl, data.externalIdentifier) || null;
      const now = new Date();
      const publishedAt = data.status === 'published' ? now : null;

      try {
        const content = await prisma.$transaction(async (tx) => {
          const created = await tx.content.create({
            data: {
              type: data.type,
              title: data.title,
              slug,
              description: data.description || null,
              status: data.status || 'draft',
              language: data.language || null,
              thumbnailUrl: data.thumbnailUrl || null,
              coverUrl: data.coverUrl || null,
              series: data.series || null,
              provider: data.provider,
              sourceUrl: data.sourceUrl,
              externalIdentifier: data.externalIdentifier || null,
              embedUrl,
              collectionIdentifier: data.collectionIdentifier || null,
              collectionTitle: data.collectionTitle || null,
              durationMin: data.durationMin || null,
              episodes: data.episodes || null,
              pages: data.pages || null,
              year: data.year || null,
              metadata: data.metadata as any,
              createdBy: adminUsername(req),
              updatedBy: adminUsername(req),
              publishedAt,
            },
          });

          if (data.scholarIds?.length) {
            await tx.contentScholar.createMany({
              data: data.scholarIds.map((sid: string) => ({ contentId: created.id, scholarId: sid })),
            });
          }
          if (data.subjectIds?.length) {
            await tx.contentSubject.createMany({
              data: data.subjectIds.map((sid: string) => ({ contentId: created.id, subjectId: sid })),
            });
          }

          return tx.content.findUnique({
            where: { id: created.id },
            include: { scholars: { include: { scholar: true } }, subjects: { include: { subject: true } } },
          });
        });

        return reply.code(201).send({ data: content });
      } catch (e: any) {
        if (e.code === 'P2002') return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Slug conflict' } });
        throw e;
      }
    });
  }

  // — Update (admin) —
  for (const base of ['/api/admin/contents/:id']) {
    app.patch(base, async (req, reply) => {
      const { id } = req.params as { id: string };
      const parsed = updateContentSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
      }
      const existing = await prisma.content.findFirst({ where: { OR: [{ id }, { slug: id }] } });
      if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Content not found' } });

      const data: any = { ...parsed.data };
      if (data.provider) data.provider = normalizeProvider(data.provider);

      if (data.scholarIds) {
        const count = await prisma.scholar.count({ where: { id: { in: data.scholarIds } } });
        if (count !== data.scholarIds.length) {
          return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'One or more scholarIds do not exist' } });
        }
      }
      if (data.subjectIds) {
        const count = await prisma.subject.count({ where: { id: { in: data.subjectIds } } });
        if (count !== data.subjectIds.length) {
          return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'One or more subjectIds do not exist' } });
        }
      }

      if (data.title && data.title !== existing.title) {
        let slug = toSlug(data.title);
        let attempt = 0;
        while (await prisma.content.findFirst({ where: { slug, NOT: { id: existing.id } } })) {
          attempt++;
          slug = uniqueSlug(data.title, attempt);
        }
        data.slug = slug;
      }

      // Handle publish status transition: set/clear publishedAt
      if (data.status) {
        if (data.status === 'published' && existing.status !== 'published') {
          data.publishedAt = new Date();
        } else if (data.status !== 'published' && existing.status === 'published') {
          // keep publishedAt for history? Spec says publishedAt set on publish, we keep it but not required to clear
          // We'll keep it
        }
      }

      // Rebuild embedUrl if provider/sourceUrl changed and embedUrl not explicitly set
      if ((data.provider || data.sourceUrl || data.externalIdentifier) && !data.embedUrl) {
        const provider = data.provider || existing.provider;
        const sourceUrl = data.sourceUrl || existing.sourceUrl;
        const externalId = data.externalIdentifier !== undefined ? data.externalIdentifier : existing.externalIdentifier;
        const built = buildEmbedUrl(provider, sourceUrl, externalId);
        if (built) data.embedUrl = built;
      }

      // Empty strings from the admin forms mean "clear this field" — store NULL, not ''
      if (data.thumbnailUrl === '') data.thumbnailUrl = null;
      if (data.coverUrl === '') data.coverUrl = null;
      if (data.embedUrl === '') data.embedUrl = null;

      const { scholarIds, subjectIds, ...rest } = data;
      // attribution: who touched this record last (null for the legacy token / localhost)
      rest.updatedBy = adminUsername(req);

      const updated = await prisma.$transaction(async (tx) => {
        await tx.content.update({ where: { id: existing.id }, data: rest });

        if (scholarIds !== undefined) {
          await tx.contentScholar.deleteMany({ where: { contentId: existing.id } });
          if (scholarIds.length) {
            await tx.contentScholar.createMany({
              data: scholarIds.map((sid: string) => ({ contentId: existing.id, scholarId: sid })),
            });
          }
        }
        if (subjectIds !== undefined) {
          await tx.contentSubject.deleteMany({ where: { contentId: existing.id } });
          if (subjectIds.length) {
            await tx.contentSubject.createMany({
              data: subjectIds.map((sid: string) => ({ contentId: existing.id, subjectId: sid })),
            });
          }
        }

        return tx.content.findUnique({
          where: { id: existing.id },
          include: { scholars: { include: { scholar: true } }, subjects: { include: { subject: true } } },
        });
      });

      return { data: updated };
    });
  }

  // — Delete / Archive —
  for (const base of ['/api/admin/contents/:id']) {
    app.delete(base, async (req, reply) => {
      const { id } = req.params as { id: string };
      const { hard, confirm } = req.query as { hard?: string; confirm?: string };
      const existing = await prisma.content.findFirst({ where: { OR: [{ id }, { slug: id }] } });
      if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Content not found' } });

      if (hard === 'true') {
        // Fase 5.3 (audit I7): a hard delete erases the record and cannot be undone, so it needs an
        // explicit confirmation that names the record — `?hard=true` alone is one typo away from
        // destroying content. Archive (the default) keeps the row and hides it from the public site.
        const supplied = (confirm ?? '').trim();
        if (supplied !== existing.id && supplied !== existing.slug) {
          return reply.code(400).send({
            error: {
              code: 'CONFIRM_REQUIRED',
              message:
                `Removing “${existing.title}” deletes the record for good and cannot be undone. ` +
                'Repeat its id or slug in ?confirm=<id|slug> to proceed, or archive it instead (DELETE without hard=true).',
            },
          });
        }
        await prisma.content.delete({ where: { id: existing.id } });
        // The row — and with it createdBy/updatedBy — is gone after this, so the server log is the
        // only remaining trace of who removed what. No credentials in the line, only the identity.
        req.log.warn(
          { operator: adminUsername(req), id: existing.id, slug: existing.slug, title: existing.title },
          'Content hard-deleted',
        );
        return { data: { id: existing.id, deleted: true, hard: true } };
      } else {
        const archived = await prisma.content.update({
          where: { id: existing.id },
          data: { status: 'archived', updatedBy: adminUsername(req) },
          include: { scholars: { include: { scholar: true } }, subjects: { include: { subject: true } } },
        });
        return { data: archived };
      }
    });
  }

  // — Publish / Unpublish —
  app.post('/api/admin/contents/:id/publish', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.content.findFirst({ where: { OR: [{ id }, { slug: id }] } });
    if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Content not found' } });
    if (existing.status === 'published') return { data: existing };
    // Validation: need title, sourceUrl, at least one scholar/subject
    const scholarCount = await prisma.contentScholar.count({ where: { contentId: existing.id } });
    const subjectCount = await prisma.contentSubject.count({ where: { contentId: existing.id } });
    if (!existing.title || existing.title.length < 3) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Title too short to publish' } });
    }
    if (!existing.sourceUrl) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'sourceUrl required to publish' } });
    }
    if (scholarCount === 0) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'At least one scholar required to publish' } });
    }
    if (subjectCount === 0) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'At least one subject required to publish' } });
    }
    const updated = await prisma.content.update({
      where: { id: existing.id },
      data: { status: 'published', publishedAt: new Date(), updatedBy: adminUsername(req) },
      include: { scholars: { include: { scholar: true } }, subjects: { include: { subject: true } } },
    });
    return { data: updated };
  });

  app.post('/api/admin/contents/:id/unpublish', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.content.findFirst({ where: { OR: [{ id }, { slug: id }] } });
    if (!existing) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Content not found' } });
    if (existing.status !== 'published') return { data: existing };
    const updated = await prisma.content.update({
      where: { id: existing.id },
      data: { status: 'draft', updatedBy: adminUsername(req) },
      include: { scholars: { include: { scholar: true } }, subjects: { include: { subject: true } } },
    });
    return { data: updated };
  });

  // Bulk endpoints placeholder (not yet implemented beyond status update)
  app.patch('/api/admin/contents/bulk', async (req, reply) => {
    const { ids, patch } = req.body as { ids: string[]; patch: any };
    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'ids required' } });
    }
    // Only allow status and maybe scholar/subject bulk? For now only status
    const allowed: any = {};
    if (patch.status) allowed.status = patch.status;
    if (patch.language) allowed.language = patch.language;
    if (Object.keys(allowed).length === 0) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'No valid patch fields' } });
    }
    if (allowed.status === 'published') allowed.publishedAt = new Date();
    allowed.updatedBy = adminUsername(req);
    const result = await prisma.content.updateMany({ where: { id: { in: ids } }, data: allowed });
    return { data: { count: result.count } };
  });
}
