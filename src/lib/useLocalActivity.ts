/**
 * "Continue where you left off" — the device-local rail's data layer (Discovery step D5).
 *
 * The storage half lives in `localActivity.ts`; this hook adds the one thing storage cannot know: does
 * the remembered item **still exist** in the published library? A remembered id is not evidence — the
 * content may have been archived, unpublished or removed since, so every entry is checked against the
 * API before it is shown (owner instruction §4), and an entry the API answers with 404 is forgotten
 * (owner instruction §1: "kan omgaan met ontbrekende/verwijderde content").
 *
 * Decisions worth naming:
 *   - **nothing is requested when nothing is remembered.** A visitor who has never opened a content
 *     page (or who cleared the list) costs zero requests — the rail is simply absent.
 *   - **one request per remembered item**, the existing `GET /api/contents/:id|slug` that a detail page
 *     already uses. The API has no bulk "give me these ids" filter, and inventing a query with `q` would
 *     match on text rather than identity (a real match by accident is exactly the kind of fake result
 *     this project forbids).
 *   - **a failure is not deletion.** Only a *404* forgets an entry; a network or server error leaves it
 *     alone, so an offline moment cannot wipe the visitor's list.
 *   - the hook returns data, never markup: `ContinueRail` decides how it looks.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPublishedContent, type BackendContent } from '@/lib/api';
import { clearActivity, forgetActivity, readActivity, type ActivityEntry } from '@/lib/localActivity';

export type RecentActivityItem = {
  entry: ActivityEntry;
  /** the current published record — always fresh from the API, never a remembered copy */
  content: BackendContent;
};

export type RecentActivityResult = {
  items: RecentActivityItem[];
  /** true when this device remembers anything at all, even if none of it is still published */
  hasStored: boolean;
  /** true while the remembered items are being checked against the API */
  loading: boolean;
  /** wipes every remembered entry on this device */
  clear: () => void;
  /** re-reads storage and re-checks the items (after a visit to a detail page, for example) */
  refresh: () => void;
};

const NOT_FOUND = 404;

export function useRecentActivity(limit = 8): RecentActivityResult {
  const [entries, setEntries] = useState<ActivityEntry[]>(() => readActivity().slice(0, limit));
  const [items, setItems] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(() => entries.length > 0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    if (entries.length === 0) {
      setItems([]);
      setLoading(false);
      return () => {
        alive = false;
      };
    }

    Promise.allSettled(entries.map((entry) => getPublishedContent(entry.id)))
      .then((results) => {
        if (!alive) return;
        const resolved: RecentActivityItem[] = [];
        results.forEach((result, index) => {
          const entry = entries[index];
          if (!entry) return;
          if (result.status === 'fulfilled') {
            const content = result.value.data;
            if (content && content.id === entry.id) resolved.push({ entry, content });
            return;
          }
          const status = (result.reason as { status?: number })?.status;
          // Gone for good (archived, unpublished, deleted): forget it — the rail must not link to it.
          if (status === NOT_FOUND) forgetActivity(entry.id);
        });
        setItems(resolved);
        setLoading(false);
      })
      .catch(() => {
        // `allSettled` does not reject; this only guards against a broken promise implementation.
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
    // `nonce` re-runs the identical check on request; `entries` is the list read from storage.
  }, [entries, nonce]);

  const refresh = useCallback(() => {
    setEntries(readActivity().slice(0, limit));
    setNonce((n) => n + 1);
  }, [limit]);

  const clear = useCallback(() => {
    clearActivity();
    setEntries([]);
    setItems([]);
    setLoading(false);
  }, []);

  return useMemo(
    () => ({ items, hasStored: entries.length > 0, loading, clear, refresh }),
    [items, entries.length, loading, clear, refresh],
  );
}
