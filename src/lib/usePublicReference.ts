/**
 * The published reference lists — scholars and subjects — as one small hook each (D1, D3).
 *
 * `listPublicScholars()` and `listPublicSubjects()` answer with the whole published list in one request
 * (neither endpoint pages), so there is no query key to build — but the surrounding behaviour must be
 * the same as `useContentQuery`'s, or two lists on the same page would behave differently:
 *
 *   - the request is not written to state after unmount (`alive` flag; neither endpoint takes a signal);
 *   - `total` is `data.length` — the honest size of the list the API actually returned. No count is
 *     derived from a window of contents, and a scholar with no published work is still a real scholar;
 *   - `shouldHide` is the discovery contract: a failing request or an empty list shows nothing (rails) —
 *     a page decides for itself between an error card and an honest empty state, so it can read `error`
 *     and `loading` too;
 *   - `retry()` re-runs the identical request (the same nonce pattern as `useContentQuery`), so a retry
 *     never has to reload the page.
 *
 * Used by the landing scholar rail (D1), the scholar hub and the subject hub (D3) and the global search
 * (D4). One implementation, so the three cannot drift apart.
 */
import { useCallback, useEffect, useState } from 'react';
import { listPublicScholars, listPublicSubjects, type BackendScholar, type BackendSubject } from '@/lib/api';

export type PublicReferenceResult<T> = {
  data: T[];
  /** size of the list the API returned (these endpoints do not page) */
  total: number;
  loading: boolean;
  /** Visitor-readable message when the request failed; `null` otherwise. */
  error: string | null;
  /** True when there is nothing honest to show: the request failed, or the list is empty. */
  shouldHide: boolean;
  /** Re-runs the request in place (no page reload, no lost filters). */
  retry: () => void;
};

type ReferenceState<T> = Omit<PublicReferenceResult<T>, 'retry'>;

function emptyState<T>(loading = false): ReferenceState<T> {
  return { data: [], total: 0, loading, error: null, shouldHide: true };
}

function useReferenceList<T>(
  load: () => Promise<{ data: T[] }>,
  { enabled = true, errorMessage }: { enabled?: boolean; errorMessage?: string } = {},
): PublicReferenceResult<T> {
  const [state, setState] = useState<ReferenceState<T>>(() => emptyState<T>(enabled));
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState(emptyState<T>());
      return;
    }
    let alive = true;
    setState((previous) => ({ ...previous, loading: true, error: null }));

    load()
      .then((res) => {
        if (!alive) return;
        const data = res.data ?? [];
        setState({ data, total: data.length, loading: false, error: null, shouldHide: data.length === 0 });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setState({ ...emptyState<T>(), error: (e as Error)?.message || errorMessage || 'The request failed' });
      });

    return () => {
      alive = false;
    };
    // `load` is one of the two stable module-level functions below, so it is not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, errorMessage, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, retry };
}

export function usePublicScholars(options: { enabled?: boolean; errorMessage?: string } = {}): PublicReferenceResult<BackendScholar> {
  return useReferenceList<BackendScholar>(listPublicScholars, options);
}

export function usePublicSubjects(options: { enabled?: boolean; errorMessage?: string } = {}): PublicReferenceResult<BackendSubject> {
  return useReferenceList<BackendSubject>(listPublicSubjects, options);
}
