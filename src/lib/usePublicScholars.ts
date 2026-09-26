/**
 * The published scholars, as one small hook (Discovery step D1).
 *
 * `listPublicScholars()` answers with the whole published list in one request (no paging), so there is
 * no query key to build — but the surrounding behaviour must be the same as `useContentQuery`'s, or the
 * two kinds of rail on the same page would behave differently:
 *
 *   - the request is not written to state after unmount (`alive` flag; the endpoint takes no signal);
 *   - `total` is `data.length` — the honest size of the list the API actually returned. No count is
 *     derived from a window of contents, and a scholar with no published work is still a real scholar;
 *   - `shouldHide` is the same discovery contract: a failing request or an empty list renders nothing.
 *
 * Used by the landing scholar rail (D1). The scholar hub (D3) and the global search (D4) reuse the
 * endpoint — not a second copy of this logic.
 */
import { useEffect, useState } from 'react';
import { listPublicScholars, type BackendScholar } from '@/lib/api';

export type PublicScholarsResult = {
  data: BackendScholar[];
  /** size of the list the API returned (the endpoint does not page) */
  total: number;
  loading: boolean;
  /** Visitor-readable message when the request failed; `null` otherwise. */
  error: string | null;
  /** True when there is nothing honest to show: the request failed, or the list is empty. */
  shouldHide: boolean;
};

const EMPTY: PublicScholarsResult = { data: [], total: 0, loading: false, error: null, shouldHide: true };

export function usePublicScholars({ enabled = true, errorMessage }: { enabled?: boolean; errorMessage?: string } = {}): PublicScholarsResult {
  const [result, setResult] = useState<PublicScholarsResult>({ ...EMPTY, loading: enabled });

  useEffect(() => {
    if (!enabled) {
      setResult(EMPTY);
      return;
    }
    let alive = true;
    setResult((previous) => ({ ...previous, loading: true, error: null }));

    listPublicScholars()
      .then((res) => {
        if (!alive) return;
        const data = res.data ?? [];
        setResult({ data, total: data.length, loading: false, error: null, shouldHide: data.length === 0 });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setResult({ ...EMPTY, error: (e as Error)?.message || errorMessage || 'The request failed', shouldHide: true });
      });

    return () => {
      alive = false;
    };
  }, [enabled, errorMessage]);

  return result;
}
