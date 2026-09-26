import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { gzip } from 'zlib';
import { promisify } from 'util';
import { prisma } from '../lib/prisma';
import { publicOrigin } from '../lib/proxy';
import { isStaging } from '../lib/env';

/**
 * `/robots.txt` and `/sitemap.xml` (Fase 5.5).
 *
 * Before this, both paths fell through to the SPA fallback and were answered with `index.html` and
 * HTTP 200: a crawler asking for a sitemap received an HTML page, and the site had no crawl rules at
 * all. They are served here — not as files in `dist` — because the library grows through the CMS and
 * a static file would only be correct until the next deploy.
 *
 * Rules kept deliberately:
 *  - The origin comes from `PUBLIC_ORIGIN` (the canonical origin from Fase 5.2). Without it we fall
 *    back to the host the request arrived on, which is the honest answer for local/dev servers; a
 *    sitemap must contain absolute URLs, so there is no way to leave it out.
 *  - Only URLs the app really serves are listed, with the same paths its own links use
 *    (`/lectures/<slug>` for lectures/audio/video, `/books/<slug>` for books/documents, `/series/<id>`
 *    for collections, `/subjects/<slug>` for shelves). Scholars have no public detail page, so they
 *    are not listed.
 *  - Published rows only — the public site shows nothing else.
 *  - The XML is cached for an hour (per origin): the query is one `findMany` over the whole library,
 *    which is fine once an hour and wasteful per request.
 *  - The 50 000-URL / 50 MB limits from sitemaps.org are respected: at most 45 000 content URLs are
 *    listed, newest first (see docs/CONTEXT.md §9 for the follow-up if the library ever gets that big:
 *    a sitemap *index* with several files).
 */
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CONTENT_URLS = 45_000;
const gzipAsync = promisify(gzip);

type SitemapCacheEntry = { xml: string; gzip: Buffer | null; expiresAt: number; lastModified: Date | null };
const sitemapCache = new Map<string, SitemapCacheEntry>();

/** Absolute origin for the sitemap: the configured canonical one, else the request's own host. */
function originOf(req: FastifyRequest): string {
  const configured = publicOrigin();
  if (configured) return configured;
  const host = req.headers.host;
  return host ? `${req.protocol}://${host}` : '';
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function contentPath(row: { slug: string; type: string }): string {
  const isBook = row.type === 'book' || row.type === 'document';
  return `/${isBook ? 'books' : 'lectures'}/${encodeURIComponent(row.slug)}`;
}

function urlEntry(loc: string, lastmod?: Date | null, changefreq?: string, priority?: string): string {
  const parts = [`    <loc>${escapeXml(loc)}</loc>`];
  if (lastmod && !Number.isNaN(lastmod.getTime())) parts.push(`    <lastmod>${lastmod.toISOString()}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`    <priority>${priority}</priority>`);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

async function buildSitemap(origin: string): Promise<{ xml: string; lastModified: Date | null }> {
  const [contents, subjects] = await Promise.all([
    prisma.content.findMany({
      where: { status: 'published' },
      select: { slug: true, type: true, updatedAt: true, collectionIdentifier: true },
      orderBy: { updatedAt: 'desc' },
      take: MAX_CONTENT_URLS,
    }),
    prisma.subject.findMany({
      where: { status: 'published' },
      select: { slug: true, updatedAt: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  // One series page per collection, dated by its most recently touched item.
  const collections = new Map<string, Date>();
  for (const row of contents) {
    if (!row.collectionIdentifier) continue;
    const seen = collections.get(row.collectionIdentifier);
    if (!seen || row.updatedAt > seen) collections.set(row.collectionIdentifier, row.updatedAt);
  }

  let lastModified: Date | null = null;
  const track = (date: Date | null | undefined) => {
    if (date && (!lastModified || date > lastModified)) lastModified = date;
  };
  for (const row of contents) track(row.updatedAt);
  for (const row of subjects) track(row.updatedAt);

  const entries: string[] = [
    // The five static pages the router always serves. No lastmod: they are not content rows.
    urlEntry(`${origin}/`, null, 'weekly', '1.0'),
    urlEntry(`${origin}/lectures`, null, 'daily', '0.9'),
    urlEntry(`${origin}/books`, null, 'daily', '0.9'),
    urlEntry(`${origin}/scholars`, null, 'weekly', '0.7'),
    urlEntry(`${origin}/subjects`, null, 'weekly', '0.7'),
    ...[...collections.entries()].map(([identifier, updatedAt]) =>
      urlEntry(`${origin}/series/${encodeURIComponent(identifier)}`, updatedAt, 'monthly', '0.6'),
    ),
    ...subjects.map((s) => urlEntry(`${origin}/subjects/${encodeURIComponent(s.slug)}`, s.updatedAt, 'monthly', '0.6')),
    ...contents.map((c) => urlEntry(`${origin}${contentPath(c)}`, c.updatedAt, 'monthly', '0.5')),
  ];

  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`,
    lastModified,
  };
}

  async function sitemapFor(origin: string): Promise<SitemapCacheEntry> {
    // Staging publishes no URLs (environment rule): the same pages are advertised from the production
    // origin, and an empty sitemap keeps every crawler-side check (deploy-check.sh) honest about what
    // this deployment actually offers instead of leaking a staging hostname into search results.
    if (isStaging()) {
      return {
        xml:
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<!-- ilmNet staging: no URLs are advertised outside production. See docs/ENVIRONMENTS.md. -->\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n',
        gzip: null,
        expiresAt: Date.now() + CACHE_TTL_MS,
        lastModified: null,
      };
    }

    const cached = sitemapCache.get(origin);
  if (cached && cached.expiresAt > Date.now()) return cached;

  const { xml, lastModified } = await buildSitemap(origin);
  const entry: SitemapCacheEntry = { xml, gzip: null, expiresAt: Date.now() + CACHE_TTL_MS, lastModified };
  sitemapCache.set(origin, entry);
  return entry;
}

async function sendXml(req: FastifyRequest, reply: FastifyReply, entry: SitemapCacheEntry) {
  if (entry.lastModified) reply.header('last-modified', entry.lastModified.toUTCString());
  reply.header('cache-control', `public, max-age=${Math.floor(CACHE_TTL_MS / 1000)}`);
  reply.header('vary', 'accept-encoding');
  // A 20 000-URL sitemap is ~1,5 MB of XML. The static frontend ships a pre-compressed variant
  // (Fase 5.4); this route is generated per hour, so it compresses on first request instead and the
  // gzip buffer is cached together with the XML.
  const wantsGzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
  if (wantsGzip) {
    if (!entry.gzip) entry.gzip = await gzipAsync(Buffer.from(entry.xml, 'utf8'));
    return reply.type('application/xml; charset=utf-8').header('content-encoding', 'gzip').send(entry.gzip);
  }
  return reply.type('application/xml; charset=utf-8').send(entry.xml);
}

  function robotsFor(origin: string): string {
    // Environment rule (docs/ENVIRONMENTS.md): a staging deployment must never be crawled. It serves
    // the same build and the same content as production, so an indexed staging host would compete
    // with the real site for the same pages. Staging therefore advertises nothing at all.
    if (isStaging()) {
      return (
        [
          '# ilmNet — staging environment: crawling is disabled on purpose.',
          '# The same content exists on the production origin; index that one.',
          'User-agent: *',
          'Disallow: /',
        ].join('\n') + '\n'
      );
    }
    const lines = [
      '# ilmNet — a free public library; only the CMS and the API are off limits.',
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /api/',
    ];
    if (origin) lines.push('', `Sitemap: ${origin}/sitemap.xml`);
    return `${lines.join('\n')}\n`;
  }

/** Exposed for the production test suite so a test can drop the cache between assertions. */
export function resetSeoCache(): void {
  sitemapCache.clear();
}

export async function seoRoutes(app: FastifyInstance) {
  app.get('/robots.txt', async (req, reply) => {
    reply.header('cache-control', 'public, max-age=3600');
    return reply.type('text/plain; charset=utf-8').send(robotsFor(originOf(req)));
  });

  app.get('/sitemap.xml', async (req, reply) => {
    const origin = originOf(req);
    if (!origin) {
      return reply.code(500).send({ error: { code: 'NO_ORIGIN', message: 'No origin available for the sitemap' } });
    }
    return sendXml(req, reply, await sitemapFor(origin));
  });
}
