/**
 * One hook around `listPublishedContents` (Discovery step D0).
 *
 * Every consumer of the public library shares this: the four list pages today, the discovery rails
 * and the search page next. It exists so that the details that are easy to get wrong are written
 * once:
 *
 *   - **in-flight requests are aborted** when the filters change or the component unmounts, so an
 *     older answer can never overwrite a newer one (the pages used a `cancelled` flag for this);
 *   - **`total` is the API's own `pagination.total`**, not `data.length`. A list page that shows
 *     "15 items" while 1 200 match is lying, and the audit (A5) called that out; roles that need a
 *     count now take it from here;
 *   - **`shouldHide`** implements the discovery contract used everywhere in this plan: a rail with a
 *     failing request or an empty result renders nothing at all, rather than a plausible-looking 0 or
 *     a mock card. Pages that want to show an error keep `error` and decide for themselves.
 *
 * No dependency, no caching layer, no state library: one request per query, exactly like before.
 */
import { useEffect, useMemo, useState } from 'react';
import { listPublishedContents, type BackendContent } from '@/lib/api';
import { buildContentParams, contentQueryKey, type ContentQueryFilters, type ContentShelf } from '@/lib/contentQuery';

export type ContentQueryResult = {
  data: BackendContent[];
  /** `pagination.total` from the API — the honest number of records matching this filter. */
  total: number;
  totalPages: number;
  page: number;
  loading: boolean;
  /** Visitor-readable message when the request failed; `null` otherwise. */
  error: string | null;
  /** True when there is nothing honest to show: the request failed, or it matched nothing. */
  shouldHide: boolean;
};

export type UseContentQueryOptions = {
  shelf: ContentShelf;
  limit?: number;
  page?: number;
  sort?: string;
  /** `false` skips the request entirely (a rail that has not been scrolled into view yet). */
  enabled?: boolean;
  /** Page-specific fallback text shown when the error carries no message. */
  errorMessage?: string;
};

const EMPTY: ContentQueryResult = {
  data: [],
  total: 0,
  totalPages: 0,
  page: 1,
  loading: false,
  error: null,
  shouldHide: true,
};

export function useContentQuery(
  filters: ContentQueryFilters,
  { shelf, limit = 100, page = 1, sort, enabled = true, errorMessage }: UseContentQueryOptions,
): ContentQueryResult {
  const params = useMemo(
    () => buildContentParams(filters, { shelf, limit, page, sort }),
    [filters.q, filters.scholar, filters.subject, filters.type, filters.collection, shelf, limit, page, sort],
  );
  // Depend on the query string, not on the object: a re-render with the same filters must not refetch.
  const key = contentQueryKey(params);

  const [result, setResult] = useState<ContentQueryResult>({ ...EMPTY, loading: enabled });

  useEffect(() => {
    if (!enabled) {
      setResult(EMPTY);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setResult((previous) => ({ ...previous, loading: true, error: null }));

    listPublishedContents(params, { signal: controller.signal })
      .then((res) => {
        if (!active) return;
        const data = res.data ?? [];
        setResult({
          data,
          total: res.pagination?.total ?? data.length,
          totalPages: res.pagination?.totalPages ?? 1,
          page: res.pagination?.page ?? page,
          loading: false,
          error: null,
          shouldHide: data.length === 0,
        });
      })
      .catch((e: unknown) => {
        // An aborted request is not a failure: a newer query is already on its way.
        if (!active || (e as Error)?.name === 'AbortError') return;
        const message = (e as Error)?.message || errorMessage || 'The request failed';
        setResult({ ...EMPTY, error: message, shouldHide: true });
      });

    return () => {
      active = false;
      controller.abort();
    };
    // `params` is rebuilt only when a filter changes, and `key` captures that change precisely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return result;
}
