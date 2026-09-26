/**
 * Central content-query logic for the public library (Discovery step D0).
 *
 * One place decides how a visible filter becomes an API query, so the pages, the discovery rails and
 * the (future) search page cannot drift apart. Nothing here invents data: the values are exactly the
 * ones `/api/contents` accepts (see `server/src/lib/validation.ts`), and the shelf mapping is the one
 * the two library pages already used — moved, not changed.
 *
 * Pure functions only: no React, no fetching. `useContentQuery` (src/lib/useContentQuery.ts) executes
 * these params; this module decides what they are.
 */

/**
 * The public shelves. They are views over the same `contents` table, not separate data.
 *
 * `library` (D1) is the whole shelf set at once: the landing page's "new in the library" rail asks for
 * everything published, in one request, and picks the card per record.
 */
export type ContentShelf = 'lectures' | 'books' | 'library';

/**
 * Default `type` filter per shelf — the same values the pages sent before:
 *   /lectures without a format filter → lecture, video, audio
 *   /books without a format filter    → book, document
 *   library                           → no type filter at all (every published type)
 */
export const SHELF_TYPES: Record<ContentShelf, string | null> = {
  lectures: 'lecture,video,audio',
  books: 'book,document',
  library: null,
};

/** Filters as they appear in the URL. Empty string and 'all' both mean "no filter". */
export type ContentQueryFilters = {
  q?: string;
  scholar?: string;
  subject?: string;
  /** raw URL value: 'all', 'audio', 'Video', 'video', 'book', 'document' … */
  type?: string;
  collection?: string;
};

/** Query parameters for `GET /api/contents` (the shape `listPublishedContents` takes). */
export type PublicContentParams = Record<string, string | number | undefined>;

/** True for the values that mean "not filtering on this". */
function unset(value: string | undefined): boolean {
  return value === undefined || value.trim() === '' || value === 'all';
}

/**
 * Maps a URL `type` value onto the API's comma-separated `type` parameter.
 *
 * The API accepts several types at once, which is what makes a shelf possible: a page that shows
 * "lectures" is really asking for lecture + video + audio. `null` means "send no type filter at all"
 * (the whole library). Passing an unknown value through unchanged keeps the old behaviour (the API
 * answers with an honest empty result rather than a 500).
 */
export function typeFilterToApi(shelf: ContentShelf, type?: string): string | null {
  const value = (type ?? '').trim();
  if (!value || value === 'all') return SHELF_TYPES[shelf];

  if (shelf === 'lectures') {
    // The format chips send 'Audio' / 'Video'; the URL may also carry the raw API values.
    if (value === 'Video' || value === 'video') return 'lecture,video';
    if (value === 'Audio' || value === 'audio') return 'audio';
    return value;
  }

  if (shelf === 'books') {
    if (value === 'book' || value === 'document') return value;
    return value;
  }

  // A format asked for inside the whole library narrows that request; nothing asked stays unfiltered.
  return value;
}

/**
 * Builds the request parameters. `limit` stays 100 because that is what the current pages ask for;
 * `page` is only sent when the caller asks for a page other than the first, so a normal page load
 * keeps producing exactly the URL it produced before.
 */
export function buildContentParams(
  filters: ContentQueryFilters,
  options: { shelf: ContentShelf; limit?: number; page?: number; sort?: string },
): PublicContentParams {
  const params: PublicContentParams = {
    limit: options.limit ?? 100,
  };

  const type = typeFilterToApi(options.shelf, filters.type);
  if (type) params.type = type;

  const q = filters.q?.trim();
  if (q) params.q = q;
  if (!unset(filters.scholar)) params.scholar = filters.scholar!.trim();
  if (!unset(filters.subject)) params.subject = filters.subject!.trim();
  if (!unset(filters.collection)) params.collection = filters.collection!.trim();
  if (options.page && options.page > 1) params.page = options.page;
  if (options.sort) params.sort = options.sort;

  return params;
}

/** Reads the filters out of a URL. Used by the pages and by every future rail/search consumer. */
export function parseContentFilters(searchParams: URLSearchParams): ContentQueryFilters {
  return {
    q: searchParams.get('q') ?? undefined,
    scholar: searchParams.get('scholar') ?? undefined,
    subject: searchParams.get('subject') ?? undefined,
    type: searchParams.get('type') ?? undefined,
    collection: searchParams.get('collection') ?? undefined,
  };
}

/**
 * Whether the visitor is looking at a filtered view. Used to choose between "nothing matches your
 * filters" and "the shelf is still empty" — two different truths that need different copy.
 */
export function hasActiveFilters(filters: ContentQueryFilters): boolean {
  return Boolean(filters.q) || !unset(filters.scholar) || !unset(filters.subject) || !unset(filters.type) || !unset(filters.collection);
}

/**
 * A stable string for a set of parameters, so a hook can depend on the *query* instead of on an
 * object identity that changes on every render.
 */
export function contentQueryKey(params: PublicContentParams): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join('&');
}
