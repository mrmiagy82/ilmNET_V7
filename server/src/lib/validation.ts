import { z } from 'zod';

export const contentTypeEnum = z.enum(['lecture', 'audio', 'video', 'book', 'document']);
export const providerEnum = z.enum(['youtube', 'archive', 'external', 'google_books', 'pdf']);
// Accept both google_books and google-books from frontend, normalize later
export const providerInputEnum = z.enum(['youtube', 'archive', 'external', 'google_books', 'google-books', 'pdf']);
export const contentStatusEnum = z.enum(['draft', 'published', 'archived']);
export const subjectGroupEnum = z.enum(['Revelation', 'Practice', 'Belief', 'History', 'Language', 'Character']);

export function normalizeProvider(p: string): string {
  if (p === 'google-books') return 'google_books';
  return p;
}

// Media URLs may be: absolute http(s), our own uploaded /uploads/<file>, or an inline data: image.
// Fase 5.3: the inline form is limited to the raster types the upload endpoint accepts — an
// `image/svg+xml` (or any other `data:image/*`) data URI is a document that can carry script, and a
// URL is stored in the database and rendered by the public site, so it must not be open-ended.
export const RASTER_DATA_IMAGE = /^data:image\/(png|jpe?g|webp|gif|avif);base64,[A-Za-z0-9+/=]+$/;
export const mediaUrlSchema = z
  .string()
  .max(300000)
  .refine((v) => {
    const value = v.trim();
    if (/^https?:\/\//.test(value) || value.startsWith('/uploads/')) return true;
    return RASTER_DATA_IMAGE.test(value);
  }, {
    message:
      'Must be an absolute http(s) URL, an /uploads/<file> path, or a base64 data URI of a raster image (png, jpeg, webp, gif, avif)',
  });

export const createContentSchema = z.object({
  type: contentTypeEnum,
  title: z.string().min(3).max(300),
  description: z.string().max(5000).optional().nullable(),
  status: contentStatusEnum.optional().default('draft'),
  language: z.string().max(50).optional().nullable(),
  thumbnailUrl: mediaUrlSchema.optional().nullable().or(z.literal('')),
  coverUrl: mediaUrlSchema.optional().nullable().or(z.literal('')),
  series: z.string().max(200).optional().nullable(),
  provider: providerInputEnum,
  sourceUrl: z.string().url(),
  externalIdentifier: z.string().max(300).optional().nullable(),
  embedUrl: z.string().url().optional().nullable().or(z.literal('')),
  collectionIdentifier: z.string().max(300).optional().nullable(),
  collectionTitle: z.string().max(300).optional().nullable(),
  durationMin: z.number().int().min(1).optional().nullable(),
  episodes: z.number().int().min(1).optional().nullable(),
  pages: z.number().int().min(1).optional().nullable(),
  year: z.number().int().min(1000).max(2100).optional().nullable(),
  metadata: z.any().optional().nullable(),
  scholarIds: z.array(z.string()).optional().default([]),
  subjectIds: z.array(z.string()).optional().default([]),
});

export const updateContentSchema = createContentSchema.partial().extend({
  title: z.string().min(3).max(300).optional(),
});

export const listContentQuerySchema = z.object({
  status: z.string().optional(), // comma-separated or single
  type: z.string().optional(),
  provider: z.string().optional(),
  scholar: z.string().optional(),
  subject: z.string().optional(),
  language: z.string().optional(),
  // Fase 5.4: exact series/collection filter. The public pages used to search the identifier as free
  // text (`q=<collectionIdentifier>`), which cannot use the index and evaluated the ILIKE over every
  // row; `collection` is an equality filter on the indexed `collectionIdentifier` column.
  collection: z.string().max(300).optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(), // e.g. "createdAt:desc" or "title:asc"
});

export const createScholarSchema = z.object({
  name: z.string().min(2).max(200),
  initials: z.string().max(10).optional().nullable(),
  specialtyId: z.string().optional().nullable(),
  bio: z.string().max(5000).optional().nullable(),
  accent: z.string().max(20).optional().nullable(),
  status: contentStatusEnum.optional().default('published'),
  metadata: z.any().optional().nullable(),
});

export const updateScholarSchema = createScholarSchema.partial();

export const createSubjectSchema = z.object({
  name: z.string().min(2).max(100),
  group: subjectGroupEnum,
  description: z.string().max(2000).optional().nullable(),
  accent: z.string().max(20).optional().nullable(),
  status: contentStatusEnum.optional().default('published'),
  metadata: z.any().optional().nullable(),
});

export const updateSubjectSchema = createSubjectSchema.partial();
