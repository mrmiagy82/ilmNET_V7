import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { previewArchive, parseArchiveIdentifier, parseDurationToMinutes } from '../services/archive.service';
import { previewYouTube, parseYouTubeUrl, youtubeVideoLink, youtubeEmbedLink } from '../services/youtube.service';
import { toSlug, uniqueSlug } from '../utils/slug';

const previewSchema = z.object({
  sourceUrl: z.string().url(),
});

const confirmItemSchema = z.object({
  identifier: z.string().min(1),
  selected: z.boolean().optional().default(true),
  customTitle: z.string().min(1).max(300).optional(),
  customDescription: z.string().max(5000).optional().nullable(),
  contentType: z.enum(['lecture', 'audio', 'video', 'book', 'document']).optional().default('document'),
  scholarIds: z.array(z.string()).optional().default([]),
  subjectIds: z.array(z.string()).optional().default([]),
  language: z.string().max(50).optional().nullable(),
  series: z.string().max(200).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  status: z.enum(['draft', 'published', 'skip']).optional().default('draft'),
});

const confirmSchema = z.object({
  jobId: z.string().min(1),
  items: z.array(confirmItemSchema).min(1).max(100),
});

function buildEmbedUrl(identifier: string): string {
  return `https://archive.org/embed/${identifier}`;
}

export async function importRoutes(app: FastifyInstance) {
  // ── Archive Preview ──
  app.post('/api/admin/imports/archive/preview', async (req, reply) => {
    const parsed = previewSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
    const { sourceUrl } = parsed.data;

    const identifier = parseArchiveIdentifier(sourceUrl);
    if (!identifier) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Cannot parse Archive.org identifier from sourceUrl' } });
    }

    try {
      const preview = await previewArchive(sourceUrl);

      const job = await prisma.importJob.create({
        data: {
          provider: 'archive',
          sourceUrl: sourceUrl.trim(),
          externalIdentifier: preview.identifier,
          kind: preview.isCollection ? 'archive_collection' : 'archive_single',
          status: 'awaiting_review',
          totalItems: preview.totalItems,
          preview: preview as any,
        },
      });

      return {
        jobId: job.id,
        sourceUrl: preview.sourceUrl,
        identifier: preview.identifier,
        title: preview.title,
        description: preview.description,
        totalItems: preview.totalItems,
        items: preview.items,
        fetchedAt: preview.fetchedAt,
        isCollection: preview.isCollection,
        isSingleItem: preview.isSingleItem,
        provider: preview.provider,
        kindsSummary: preview.kindsSummary,
      };
    } catch (e: any) {
      app.log.error(e);
      const msg = e.message || 'Failed to fetch Archive.org metadata';
      try {
        await prisma.importJob.create({
          data: {
            provider: 'archive',
            sourceUrl: sourceUrl.trim(),
            externalIdentifier: identifier,
            kind: 'archive_collection',
            status: 'failed',
            error: String(msg).slice(0, 2000),
            preview: { error: String(msg) } as any,
          },
        });
      } catch {}
      return reply.code(502).send({ error: { code: 'ARCHIVE_FETCH_FAILED', message: msg } });
    }
  });

  // ── YouTube Preview ──
  app.post('/api/admin/imports/youtube/preview', async (req, reply) => {
    const parsed = previewSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
    const { sourceUrl } = parsed.data;

    const ytParsed = parseYouTubeUrl(sourceUrl);
    if (!ytParsed) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Cannot parse YouTube identifier from sourceUrl — expected youtube.com/watch?v=..., youtu.be/..., shorts/..., embed/... or playlist?list=...' } });
    }

    try {
      const preview = await previewYouTube(sourceUrl);

      const job = await prisma.importJob.create({
        data: {
          provider: 'youtube',
          sourceUrl: sourceUrl.trim(),
          externalIdentifier: preview.identifier,
          kind: preview.isCollection ? 'youtube_playlist' : 'youtube_video',
          status: 'awaiting_review',
          totalItems: preview.totalItems,
          preview: preview as any,
        },
      });

      return {
        jobId: job.id,
        sourceUrl: preview.sourceUrl,
        identifier: preview.identifier,
        title: preview.title,
        description: preview.description,
        totalItems: preview.totalItems,
        items: preview.items,
        fetchedAt: preview.fetchedAt,
        isCollection: preview.isCollection,
        isSingleItem: preview.isSingleItem,
        provider: preview.provider,
        kindsSummary: preview.kindsSummary,
        // How the metadata was fetched ('api' = official Data API via the server-side key,
        // 'page' = public YouTube pages) plus non-fatal findings for the operator.
        metadataSource: preview.metadataSource,
        warnings: preview.warnings,
      };
    } catch (e: any) {
      app.log.error(e);
      const msg = e.message || 'Failed to fetch YouTube metadata';
      const identifier = ytParsed.playlistId || ytParsed.videoId || 'unknown';
      try {
        await prisma.importJob.create({
          data: {
            provider: 'youtube',
            sourceUrl: sourceUrl.trim(),
            externalIdentifier: identifier,
            kind: ytParsed.isPlaylist ? 'youtube_playlist' : 'youtube_video',
            status: 'failed',
            error: String(msg).slice(0, 2000),
            preview: { error: String(msg) } as any,
          },
        });
      } catch {}
      return reply.code(502).send({ error: { code: 'YOUTUBE_FETCH_FAILED', message: msg } });
    }
  });

  // ── Archive Confirm ──
  app.post('/api/admin/imports/archive/confirm', async (req, reply) => {
    const parsed = confirmSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
    const { jobId, items } = parsed.data;

    const job = await prisma.importJob.findUnique({ where: { id: jobId } });
    if (!job) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'ImportJob not found' } });
    if (job.provider !== 'archive') return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Job provider mismatch' } });

    const preview = job.preview as any as {
      identifier: string;
      title?: string;
      items: any[];
      isCollection: boolean;
    };
    if (!preview || !Array.isArray(preview.items)) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Job preview missing or corrupted' } });
    }

    const previewById = new Map<string, any>();
    for (const it of preview.items) previewById.set(String(it.identifier), it);

    const allScholarIds = new Set<string>();
    const allSubjectIds = new Set<string>();
    for (const it of items) {
      for (const s of it.scholarIds || []) allScholarIds.add(s);
      for (const s of it.subjectIds || []) allSubjectIds.add(s);
    }
    const scholarIdsArr = [...allScholarIds];
    const subjectIdsArr = [...allSubjectIds];
    let validScholars = new Set<string>();
    let validSubjects = new Set<string>();
    if (scholarIdsArr.length) {
      const found = await prisma.scholar.findMany({ where: { id: { in: scholarIdsArr } }, select: { id: true } });
      validScholars = new Set(found.map((s) => s.id));
    }
    if (subjectIdsArr.length) {
      const found = await prisma.subject.findMany({ where: { id: { in: subjectIdsArr } }, select: { id: true } });
      validSubjects = new Set(found.map((s) => s.id));
    }

    const toProcess = items.filter((it) => it.selected !== false && it.status !== 'skip');

    const results: Array<{
      identifier: string;
      status: 'created' | 'duplicate' | 'error' | 'skipped';
      contentId?: string;
      slug?: string;
      message?: string;
    }> = [];

    let createdCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    await prisma.importJob.update({ where: { id: job.id }, data: { status: 'importing' } });

    for (const draft of toProcess) {
      const id = String(draft.identifier).trim();
      const base = previewById.get(id);

      const title = (draft.customTitle?.trim() || base?.title || id).slice(0, 300);
      if (!title || title.length < 3) {
        results.push({ identifier: id, status: 'error', message: 'Title too short' });
        errorCount++;
        continue;
      }
      const description = (draft.customDescription != null ? String(draft.customDescription) : base?.description || '') as string;
      const contentType = (draft.contentType || 'document') as 'lecture' | 'audio' | 'video' | 'book' | 'document';
      const scholarIds = (draft.scholarIds || []).filter((s) => validScholars.has(s));
      const subjectIds = (draft.subjectIds || []).filter((s) => validSubjects.has(s));
      const language = draft.language?.trim() || base?.language || null;
      const series = draft.series?.trim() || null;
      const status = draft.status === 'published' ? 'published' : 'draft';

      if (status === 'published' && (scholarIds.length === 0 || subjectIds.length === 0)) {
        results.push({ identifier: id, status: 'error', message: 'Published requires at least one scholar and one subject' });
        errorCount++;
        continue;
      }

      const existing = await prisma.content.findFirst({
        where: { provider: 'archive', externalIdentifier: id },
        select: { id: true, slug: true, title: true },
      });
      if (existing) {
        results.push({ identifier: id, status: 'duplicate', contentId: existing.id, slug: existing.slug, message: `Already imported as "${existing.title}"` });
        duplicateCount++;
        continue;
      }

      const archiveUrl = base?.archiveUrl || `https://archive.org/details/${id}`;
      const embedUrl = base?.embedUrl || buildEmbedUrl(id);
      const collectionIdentifier = preview.isCollection ? String(preview.identifier) : (base?.collection || null);
      const collectionTitle = preview.isCollection ? (preview.title as string | undefined) || null : null;

      const thumb = base?.thumbnail || `https://archive.org/services/img/${id}`;
      const isBookLike = contentType === 'book' || contentType === 'document';
      const thumbnailUrl = !isBookLike ? thumb : null;
      const coverUrl = isBookLike ? thumb : null;

      const durationMin = parseDurationToMinutes(base?.duration ?? null);
      const pages: number | null = null;

      const metadata: any = {
        archive: {
          identifier: id,
          collection: base?.collection || collectionIdentifier,
          title: (base?.title || title)?.slice(0, 300),
          mediatype: base?.mediatype,
          kind: base?.kind,
          creator: base?.creator ? String(base.creator).slice(0, 200) : null,
          date: base?.date ? String(base.date).slice(0, 100) : null,
          year: base?.year ?? null,
          language: base?.language ?? null,
          subject: base?.subjectHint ? String(base.subjectHint).slice(0, 200) : null,
          mediaTypes: Array.isArray(base?.mediaTypes) ? base.mediaTypes.slice(0, 10) : null,
          duration: base?.duration ? String(base.duration).slice(0, 100) : null,
          size: base?.size ? String(base.size).slice(0, 100) : null,
          publisher: base?.publisher ? String(base.publisher).slice(0, 200) : null,
          importedFrom: job.sourceUrl,
          importedAt: new Date().toISOString(),
          jobId: job.id,
        },
        ...(draft.category ? { category: String(draft.category).slice(0, 100) } : {}),
      };

      let slug = toSlug(title);
      let attempt = 0;
      while (await prisma.content.findUnique({ where: { slug } })) {
        attempt++;
        slug = uniqueSlug(title, attempt);
      }

      try {
        const content = await prisma.$transaction(async (tx) => {
          const created = await tx.content.create({
            data: {
              type: contentType,
              title,
              slug,
              description: description || null,
              status,
              language,
              thumbnailUrl,
              coverUrl,
              series,
              provider: 'archive',
              sourceUrl: archiveUrl,
              externalIdentifier: id,
              embedUrl,
              collectionIdentifier,
              collectionTitle,
              durationMin,
              pages,
              year: base?.year ?? null,
              metadata,
              publishedAt: status === 'published' ? new Date() : null,
              importJobId: job.id,
            },
          });
          if (scholarIds.length) {
            await tx.contentScholar.createMany({ data: scholarIds.map((sid) => ({ contentId: created.id, scholarId: sid })) });
          }
          if (subjectIds.length) {
            await tx.contentSubject.createMany({ data: subjectIds.map((sid) => ({ contentId: created.id, subjectId: sid })) });
          }
          return created;
        });
        results.push({ identifier: id, status: 'created', contentId: content.id, slug: content.slug });
        createdCount++;
      } catch (e: any) {
        app.log.error(e);
        if (e.code === 'P2002') {
          results.push({ identifier: id, status: 'duplicate', message: 'Slug or identifier conflict' });
          duplicateCount++;
        } else {
          results.push({ identifier: id, status: 'error', message: e.message?.slice(0, 300) || 'Unknown error' });
          errorCount++;
        }
      }
    }

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: createdCount > 0 || duplicateCount > 0 ? 'completed' : 'failed',
        importedCount: createdCount,
        preview: {
          ...(preview as any),
          importSummary: { created: createdCount, duplicates: duplicateCount, errors: errorCount, totalRequested: toProcess.length },
        } as any,
      },
    });

    return {
      jobId: job.id,
      summary: {
        totalFound: preview.items.length,
        totalRequested: toProcess.length,
        created: createdCount,
        duplicates: duplicateCount,
        errors: errorCount,
        skipped: items.length - toProcess.length,
      },
      results,
    };
  });

  // ── YouTube Confirm ──
  app.post('/api/admin/imports/youtube/confirm', async (req, reply) => {
    const parsed = confirmSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });
    const { jobId, items } = parsed.data;

    const job = await prisma.importJob.findUnique({ where: { id: jobId } });
    if (!job) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'ImportJob not found' } });
    if (job.provider !== 'youtube') return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Job provider mismatch' } });

    const preview = job.preview as any as {
      identifier: string;
      title?: string;
      items: any[];
      isCollection: boolean;
    };
    if (!preview || !Array.isArray(preview.items)) {
      return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Job preview missing or corrupted' } });
    }

    const previewById = new Map<string, any>();
    for (const it of preview.items) previewById.set(String(it.identifier), it);

    const allScholarIds = new Set<string>();
    const allSubjectIds = new Set<string>();
    for (const it of items) {
      for (const s of it.scholarIds || []) allScholarIds.add(s);
      for (const s of it.subjectIds || []) allSubjectIds.add(s);
    }
    const scholarIdsArr = [...allScholarIds];
    const subjectIdsArr = [...allSubjectIds];
    let validScholars = new Set<string>();
    let validSubjects = new Set<string>();
    if (scholarIdsArr.length) {
      const found = await prisma.scholar.findMany({ where: { id: { in: scholarIdsArr } }, select: { id: true } });
      validScholars = new Set(found.map((s) => s.id));
    }
    if (subjectIdsArr.length) {
      const found = await prisma.subject.findMany({ where: { id: { in: subjectIdsArr } }, select: { id: true } });
      validSubjects = new Set(found.map((s) => s.id));
    }

    const toProcess = items.filter((it) => it.selected !== false && it.status !== 'skip');

    const results: Array<{
      identifier: string;
      status: 'created' | 'duplicate' | 'error' | 'skipped';
      contentId?: string;
      slug?: string;
      message?: string;
    }> = [];

    let createdCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    await prisma.importJob.update({ where: { id: job.id }, data: { status: 'importing' } });

    for (const draft of toProcess) {
      const id = String(draft.identifier).trim();
      const base = previewById.get(id);

      const title = (draft.customTitle?.trim() || base?.title || id).slice(0, 300);
      if (!title || title.length < 3) {
        results.push({ identifier: id, status: 'error', message: 'Title too short' });
        errorCount++;
        continue;
      }
      const description = (draft.customDescription != null ? String(draft.customDescription) : base?.description || '') as string;
      const contentType = (draft.contentType || 'video') as 'lecture' | 'audio' | 'video' | 'book' | 'document';
      const scholarIds = (draft.scholarIds || []).filter((s) => validScholars.has(s));
      const subjectIds = (draft.subjectIds || []).filter((s) => validSubjects.has(s));
      const language = draft.language?.trim() || base?.language || null;
      const series = draft.series?.trim() || null;
      const status = draft.status === 'published' ? 'published' : 'draft';

      if (status === 'published' && (scholarIds.length === 0 || subjectIds.length === 0)) {
        results.push({ identifier: id, status: 'error', message: 'Published requires at least one scholar and one subject' });
        errorCount++;
        continue;
      }

      const existing = await prisma.content.findFirst({
        where: { provider: 'youtube', externalIdentifier: id },
        select: { id: true, slug: true, title: true },
      });
      if (existing) {
        results.push({ identifier: id, status: 'duplicate', contentId: existing.id, slug: existing.slug, message: `Already imported as "${existing.title}"` });
        duplicateCount++;
        continue;
      }

      const youtubeUrl = base?.youtubeUrl || youtubeVideoLink(id);
      const embedUrl = base?.embedUrl || youtubeEmbedLink(id);
      const collectionIdentifier = preview.isCollection ? String(preview.identifier) : null;
      const collectionTitle = preview.isCollection ? (preview.title as string | undefined) || null : null;

      const thumb = base?.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      const isBookLike = contentType === 'book' || contentType === 'document';
      const thumbnailUrl = !isBookLike ? thumb : null;
      const coverUrl = isBookLike ? thumb : null;

      const durationMin = parseDurationToMinutes(base?.duration ?? null);
      const pages: number | null = null;

      const metadata: any = {
        youtube: {
          videoId: id,
          playlistId: collectionIdentifier,
          title: (base?.title || title)?.slice(0, 300),
          channel: base?.creator ? String(base.creator).slice(0, 200) : null,
          channelId: base?.channelId || null,
          publishedAt: base?.date || base?.publishedAt || null,
          year: base?.year ?? null,
          duration: base?.duration ? String(base.duration).slice(0, 100) : null,
          thumbnail: thumb,
          youtubeUrl,
          importedFrom: job.sourceUrl,
          importedAt: new Date().toISOString(),
          jobId: job.id,
        },
        ...(draft.category ? { category: String(draft.category).slice(0, 100) } : {}),
      };

      let slug = toSlug(title);
      let attempt = 0;
      while (await prisma.content.findUnique({ where: { slug } })) {
        attempt++;
        slug = uniqueSlug(title, attempt);
      }

      try {
        const content = await prisma.$transaction(async (tx) => {
          const created = await tx.content.create({
            data: {
              type: contentType,
              title,
              slug,
              description: description || null,
              status,
              language,
              thumbnailUrl,
              coverUrl,
              series,
              provider: 'youtube',
              sourceUrl: youtubeUrl,
              externalIdentifier: id,
              embedUrl,
              collectionIdentifier,
              collectionTitle,
              durationMin,
              pages,
              year: base?.year ?? null,
              metadata,
              publishedAt: status === 'published' ? new Date() : null,
              importJobId: job.id,
            },
          });
          if (scholarIds.length) {
            await tx.contentScholar.createMany({ data: scholarIds.map((sid) => ({ contentId: created.id, scholarId: sid })) });
          }
          if (subjectIds.length) {
            await tx.contentSubject.createMany({ data: subjectIds.map((sid) => ({ contentId: created.id, subjectId: sid })) });
          }
          return created;
        });
        results.push({ identifier: id, status: 'created', contentId: content.id, slug: content.slug });
        createdCount++;
      } catch (e: any) {
        app.log.error(e);
        if (e.code === 'P2002') {
          results.push({ identifier: id, status: 'duplicate', message: 'Slug or identifier conflict' });
          duplicateCount++;
        } else {
          results.push({ identifier: id, status: 'error', message: e.message?.slice(0, 300) || 'Unknown error' });
          errorCount++;
        }
      }
    }

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: createdCount > 0 || duplicateCount > 0 ? 'completed' : 'failed',
        importedCount: createdCount,
        preview: {
          ...(preview as any),
          importSummary: { created: createdCount, duplicates: duplicateCount, errors: errorCount, totalRequested: toProcess.length },
        } as any,
      },
    });

    return {
      jobId: job.id,
      summary: {
        totalFound: preview.items.length,
        totalRequested: toProcess.length,
        created: createdCount,
        duplicates: duplicateCount,
        errors: errorCount,
        skipped: items.length - toProcess.length,
      },
      results,
    };
  });

  // Optional: list jobs / get job
  app.get('/api/admin/imports', async () => {
    const jobs = await prisma.importJob.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    return { data: jobs };
  });
  app.get('/api/admin/imports/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const job = await prisma.importJob.findUnique({ where: { id }, include: { contents: { take: 5, include: { scholars: { include: { scholar: true } }, subjects: { include: { subject: true } } } } } });
    if (!job) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'ImportJob not found' } });
    return { data: job };
  });
}
