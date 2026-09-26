/**
 * Filter options for the library pages (Discovery step D2).
 *
 * `/lectures` and `/books` both need the same two reference lists to build their chips, and both used
 * to load them with their own copy of the same `Promise.all` (audit D6: the two pages were near-copies).
 *
 * Two consistency rules live here, because they are about the *labels* and not about the pages:
 *
 *   - **chip labels are the real names.** The pages cut every subject name at its first `&` with a
 *     regex, so a chip read "Tafs\u012br" while the subject page, the cards and the detail tags all said
 *     "Tafs\u012br & Qur'\u0101nic Sciences" — and a name with a legitimate `&` risked being mangled (audit B2).
 *   - **a failed reference list is not fatal.** The chips disappear (an honest "we cannot filter on
 *     this right now"), the content list keeps working. Nothing is invented to fill the gap.
 */
import { useEffect, useMemo, useState } from 'react';
import { listPublicScholars, listPublicSubjects, type BackendScholar, type BackendSubject } from '@/lib/api';

export type FilterOption = { value: string; label: string };

export type FilterOptionsResult = {
  scholars: BackendScholar[];
  subjects: BackendSubject[];
  scholarOptions: FilterOption[];
  subjectOptions: FilterOption[];
  /** names by slug, for the "Filters: \u2026" summary line */
  scholarBySlug: Map<string, BackendScholar>;
  subjectBySlug: Map<string, BackendSubject>;
  loading: boolean;
};

export function useFilterOptions(): FilterOptionsResult {
  const [scholars, setScholars] = useState<BackendScholar[]>([]);
  const [subjects, setSubjects] = useState<BackendSubject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listPublicScholars().catch(() => ({ data: [] as BackendScholar[] })),
      listPublicSubjects().catch(() => ({ data: [] as BackendSubject[] })),
    ]).then(([schRes, subjRes]) => {
      if (cancelled) return;
      setScholars(schRes.data ?? []);
      setSubjects(subjRes.data ?? []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const scholarBySlug = useMemo(() => new Map(scholars.map((s) => [s.slug, s])), [scholars]);
  const subjectBySlug = useMemo(() => new Map(subjects.map((s) => [s.slug, s])), [subjects]);

  return {
    scholars,
    subjects,
    scholarOptions: useMemo(() => scholars.map((s) => ({ value: s.slug, label: s.name })), [scholars]),
    subjectOptions: useMemo(() => subjects.map((s) => ({ value: s.slug, label: s.name })), [subjects]),
    scholarBySlug,
    subjectBySlug,
    loading,
  };
}
