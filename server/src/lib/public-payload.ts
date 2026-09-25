/**
 * Public API payloads (Fase 5.3).
 *
 * The public endpoints used to return the raw database row: `prisma.content.findMany()` without a
 * `select`, so every visitor received `createdBy`, `updatedBy` and `importJobId` — internal operator
 * attribution and import bookkeeping that has no place in a public response. The scholar detail
 * endpoint went further and embedded **every** linked content row, including drafts and archived
 * records, which are supposed to be invisible (audit I8).
 *
 * Instead of a deny-list (which silently leaks the next column someone adds) this module is a
 * *positive* list: a field is exposed when it is named here and nowhere else. The key lists are
 * exported so the test suite can assert the exact shape of a public response.
 *
 * Two deliberate choices:
 *   - `Content.metadata` **is** part of the public payload: it holds provider metadata that the
 *     public site renders (archive `available_media`, `tags`, `publisher`, `isbn`, YouTube
 *     identifiers) — see `src/lib/api.ts`. The importers write only provider fields into it; it is
 *     content data, not operator data. The `createdBy`/`updatedBy`/`importJobId` columns stay
 *     private.
 *   - `Scholar.metadata` / `Subject.metadata` are **not** exposed: nothing on the public site reads
 *     them, so they are operator-private by default.
 *
 * The admin endpoints (`/api/admin/*`) keep returning the full row — the CMS needs attribution
 * (`createdBy`, `updatedBy`) and `importJobId`.
 */

/** Fields a public content payload may contain. Anything else stays server-side. */
export const PUBLIC_CONTENT_KEYS = [
  'id',
  'type',
  'title',
  'slug',
  'description',
  'status',
  'language',
  'thumbnailUrl',
  'coverUrl',
  'series',
  'provider',
  'sourceUrl',
  'externalIdentifier',
  'embedUrl',
  'collectionIdentifier',
  'collectionTitle',
  'durationMin',
  'episodes',
  'pages',
  'year',
  'publishedAt',
  'createdAt',
  'updatedAt',
  'metadata',
  'scholars',
  'subjects',
] as const;

/** Fields a public scholar payload may contain. */
export const PUBLIC_SCHOLAR_KEYS = [
  'id',
  'slug',
  'name',
  'initials',
  'specialtyId',
  'specialty',
  'bio',
  'accent',
  'status',
  'createdAt',
  'updatedAt',
] as const;

/** Fields a public subject payload may contain. */
export const PUBLIC_SUBJECT_KEYS = [
  'id',
  'slug',
  'name',
  'group',
  'description',
  'accent',
  'status',
  'createdAt',
  'updatedAt',
] as const;

/** Internal columns that must never appear in a public response (used by the tests). */
export const INTERNAL_CONTENT_KEYS = ['createdBy', 'updatedBy', 'importJobId', 'importJob'] as const;

function pick<T extends readonly string[]>(source: any, keys: T): Record<string, any> {
  const out: Record<string, any> = {};
  if (!source || typeof source !== 'object') return out;
  for (const key of keys) out[key] = source[key] ?? null;
  return out;
}

function privateJson(value: unknown): unknown {
  return value === undefined ? null : value;
}

/**
 * A scholar for public consumption. The nested `specialty` (when the query included it) is reduced
 * to the public subject shape; `metadata` never leaves the server.
 */
export function publicScholar(row: any): Record<string, any> | null {
  if (!row) return null;
  const out = pick(row, PUBLIC_SCHOLAR_KEYS);
  out.specialty = row.specialty ? publicSubject(row.specialty) : null;
  return out;
}

/** A subject (shelf) for public consumption. */
export function publicSubject(row: any): Record<string, any> | null {
  if (!row) return null;
  return pick(row, PUBLIC_SUBJECT_KEYS);
}

/**
 * A content record for public consumption. Join rows keep their shape (`scholarId`/`subjectId` and
 * the optional `role`) because the frontend maps them; the embedded rows are reduced too, so a
 * linked draft/archived scholar or subject cannot leak through a nested object either.
 */
export function publicContent(row: any): Record<string, any> | null {
  if (!row) return null;
  const out = pick(row, PUBLIC_CONTENT_KEYS);
  out.metadata = privateJson(row.metadata);
  out.scholars = Array.isArray(row.scholars)
    ? row.scholars.map((join: any) => ({
        contentId: join?.contentId ?? row.id ?? null,
        scholarId: join?.scholarId ?? null,
        role: join?.role ?? null,
        scholar: publicScholar(join?.scholar),
      }))
    : [];
  out.subjects = Array.isArray(row.subjects)
    ? row.subjects.map((join: any) => ({
        contentId: join?.contentId ?? row.id ?? null,
        subjectId: join?.subjectId ?? null,
        subject: publicSubject(join?.subject),
      }))
    : [];
  return out;
}

/** Map a list of rows through a public shape (keeps `null`-safety in one place). */
export function publicList<T>(rows: any[] | null | undefined, mapper: (row: any) => T): T[] {
  return Array.isArray(rows) ? rows.map(mapper) : [];
}
