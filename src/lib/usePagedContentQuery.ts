/**
 * Accumulating paging on top of `useContentQuery` (Discovery step D2).
 *
 * The library pages used a silent `limit: 100` as a substitute for pagination: past 100 published
 * records the interface simply stopped, and its counters under-reported (audit A5). D2 replaces that
 * with real paging: a fixed page size, an honest total from the API, and a "Load more" action that
 * appends the next page.
 *
 * This hook **composes** `useContentQuery` instead of duplicating any of it: the same parameter
 * builder, the same abort handling, the same `pagination.total`. All it adds is the accumulation:
 *
 *   - `page` is derived, not stored twice: when the filters change, the key changes and the page falls
 *     back to 1 by itself, so a stale page-2 answer can never land in a fresh filter result;
 *   - items are merged **by id**, so a record that shifts between pages (someone published while you
 *     were reading) cannot appear twice;
 *   - a failure keeps what is already on screen: the first-page failure surfaces as `error` (the page
 *     shows its error card), a failure while loading more surfaces as `error` **with** `data`, so the
 *     list stays and only the "load more" line reports the problem.
 *
 * No cache, no state library, no dependency: one request per page, exactly like the pages did before.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildContentParams, contentQueryKey, type ContentQueryFilters, type ContentShelf } from '@/lib/contentQuery';
import { useContentQuery } from '@/lib/useContentQuery';
import type { BackendContent } from '@/lib/api';

export type PagedContentResult = {
  /** everything loaded so far, in API order, without duplicates */
  data: BackendContent[];
  /** `pagination.total` — how many records match this filter in the whole library */
  total: number;
  totalPages: number;
  /** the page currently on screen (1-based) */
  page: number;
  /** how many pages have really been loaded */
  pagesLoaded: number;
  /** true only for the very first load, when there is nothing to show yet */
  loading: boolean;
  /** true while an extra page is on its way (the list stays visible) */
  loadingMore: boolean;
  /** Visitor-readable message; `null` when the last request succeeded. */
  error: string | null;
  /** True when there is nothing honest to show: a failed first load, or an empty result. */
  shouldHide: boolean;
  hasMore: boolean;
  loadMore: () => void;
  /** Retry the request that failed (first page or the extra page), keeping the loaded items. */
  retry: () => void;
};

const EMPTY: BackendContent[] = [];

function mergeById(current: BackendContent[], incoming: BackendContent[]): BackendContent[] {
  if (current.length === 0) return incoming;
  const seen = new Set(current.map((c) => c.id));
  const added = incoming.filter((c) => !seen.has(c.id));
  return added.length === 0 ? current : [...current, ...added];
}

/** The page size both library shelves use. The API's own default is 20; 24 fills 8 grid rows of three. */
export const LIBRARY_PAGE_SIZE = 24;

export function usePagedContentQuery(
  filters: ContentQueryFilters,
  {
    shelf,
    pageSize = LIBRARY_PAGE_SIZE,
    sort,
    errorMessage,
    enabled = true,
  }: { shelf: ContentShelf; pageSize?: number; sort?: string; errorMessage?: string; enabled?: boolean },
): PagedContentResult {
  // The key describes the *filters* only (no page): that is what decides whether we start over.
  const key = useMemo(
    () => contentQueryKey(buildContentParams(filters, { shelf, limit: pageSize, sort })),
    [filters.q, filters.scholar, filters.subject, filters.type, filters.collection, shelf, pageSize, sort],
  );

  // One state object holds the key it belongs to, so a filter change cannot mix two result sets.
  const [state, setState] = useState<{ key: string; page: number; items: BackendContent[]; pages: number }>({
    key,
    page: 1,
    items: EMPTY,
    pages: 0,
  });
  const [nonce, setNonce] = useState(0);

  const sameKey = state.key === key;
  const page = sameKey ? state.page : 1;

  const query = useContentQuery(filters, { shelf, limit: pageSize, page, sort, errorMessage, refreshKey: nonce, enabled });

  useEffect(() => {
    if (query.loading || query.error) return;
    setState((previous) => {
      const belongs = previous.key === key;
      const items = !belongs || page === 1 ? query.data : mergeById(previous.items, query.data);
      return { key, page: belongs ? page : 1, items, pages: Math.max(belongs ? previous.pages : 0, page) };
    });
    // `query.data` is a fresh array per answer; the guard above keeps identical answers from looping.
  }, [key, page, query.data, query.loading, query.error]);

  const items = enabled && sameKey ? state.items : EMPTY;
  const total = query.total;
  const totalPages = query.totalPages;
  // "Still nothing to show" has two honest causes and one dishonest one:
  //   - the request is in flight (`query.loading`);
  //   - the filters just changed, or nothing came back for this key yet, so there is no page of
  //     results to show while an answer is on its way (`!sameKey || state.pages === 0`);
  //   - it is *not* loading when the request has already failed. Without the `!query.error` guard a
  //     failed first load would keep the loading state — and with it the spinner — forever, because the
  //     success path below never runs and `state.pages` therefore stays 0 (found in D2).
  const firstLoad = query.loading || (enabled && (!sameKey || state.pages === 0) && !query.error);
  const loadingMore = query.loading && !firstLoad;
  const hasMore = items.length > 0 && items.length < total;

  const loadMore = useCallback(() => {
    setState((previous) => (previous.key === key && previous.page < totalPages ? { ...previous, page: previous.page + 1 } : previous));
  }, [key, totalPages]);

  /**
   * Retry the request that failed. The nonce re-runs the identical query even though nothing about the
   * filters changed; the loaded items are left alone, so a failure while loading more keeps the list.
   */
  const retry = useCallback(() => setNonce((n) => n + 1), []);

  return {
    data: items,
    total,
    totalPages,
    page,
    pagesLoaded: sameKey ? state.pages : 0,
    loading: firstLoad,
    loadingMore,
    error: query.error,
    shouldHide: items.length === 0,
    hasMore,
    loadMore,
    retry,
  };
}
