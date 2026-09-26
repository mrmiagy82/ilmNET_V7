import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { usePageMeta } from '../lib/usePageMeta';
import { SearchBar, FilterChips, EmptyState, StatRow } from '../components/ui';
import { listPublicScholars, listPublicSubjects, type BackendScholar, type BackendSubject } from '@/lib/api';
import { groupByCollection } from '@/lib/series';
// Discovery step D0: the cards and the query logic live in one shared place now instead of in each page.
import { LectureCard, SeriesCard, CardSkeleton } from '@/components/cards';
import { useContentQuery } from '@/lib/useContentQuery';

export default function Lectures() {
  // Fase 5.5: this route previously shared index.html's title/description with every other page.
  // The query string is intentionally not part of the title: a filtered view is the same page.
  usePageMeta({
    title: 'Lectures',
    description:
      'Islamic lectures and talks — full courses, single talks and ongoing series. Search and filter by scholar, subject or format; your filters live in the URL.',
    path: '/lectures',
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const urlQ = searchParams.get('q') ?? '';
  const urlScholar = searchParams.get('scholar') ?? 'all';
  const urlSubject = searchParams.get('subject') ?? 'all';
  const urlFormat = (searchParams.get('type') ?? 'all') as string;

  const [inputQ, setInputQ] = useState(urlQ);
  useEffect(() => setInputQ(urlQ), [urlQ]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (inputQ !== urlQ) {
        const next = new URLSearchParams(searchParams);
        if (inputQ.trim()) next.set('q', inputQ.trim());
        else next.delete('q');
        setSearchParams(next, { replace: true });
      }
    }, 340);
    return () => clearTimeout(t);
  }, [inputQ]); // eslint-disable-line react-hooks/exhaustive-deps

  const format: 'all' | 'Audio' | 'Video' = useMemo(() => {
    if (urlFormat === 'audio') return 'Audio';
    if (urlFormat === 'video' || urlFormat === 'lecture,video' || urlFormat === 'lecture') return 'Video';
    return 'all';
  }, [urlFormat]);

  const [scholars, setScholars] = useState<BackendScholar[]>([]);
  const [subjects, setSubjects] = useState<BackendSubject[]>([]);
  const scholarBySlug = useMemo(() => new Map(scholars.map(s => [s.slug, s])), [scholars]);
  const subjectBySlug = useMemo(() => new Map(subjects.map(s => [s.slug, s])), [subjects]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listPublicScholars().catch(() => ({ data: [] as BackendScholar[] })),
      listPublicSubjects().catch(() => ({ data: [] as BackendSubject[] })),
    ]).then(([schRes, subjRes]) => {
      if (cancelled) return;
      setScholars((schRes as any).data ?? []);
      setSubjects((subjRes as any).data ?? []);
    });
    return () => { cancelled = true; };
  }, []);

  // One shared query: same request as before (limit 100, the same type mapping), plus the API's own
  // `pagination.total` so a counter can never under-report a library larger than one page.
  const { data: contents, total, loading, error } = useContentQuery(
    { q: searchParams.get('q') ?? undefined, scholar: urlScholar, subject: urlSubject, type: urlFormat },
    { shelf: 'lectures', errorMessage: 'Failed to load lectures' },
  );

  const subjectOptions = subjects.map((s) => ({ value: s.slug, label: s.name.replace(/ &.*/, '') }));
  const scholarChipOptions = scholars.map((s) => ({ value: s.slug, label: s.name }));

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: false });
  }

  const hasActiveFilters = urlQ || urlScholar !== 'all' || urlSubject !== 'all' || format !== 'all';
  const { series, standalone } = useMemo(() => groupByCollection(contents), [contents]);

  function clearAll() {
    setInputQ('');
    setSearchParams(new URLSearchParams(), { replace: false });
  }

  return (
    <>
      <PageHeader
        eyebrow="Listen & Learn"
        title="Lectures"
        intro="Full courses, single talks and ongoing series — ordered into sequences you can actually finish. Search and filter — share your view via URL."
        meta={
          <StatRow
            items={[
              { value: loading || error ? '—' : `${total}`, label: 'Items' },
              { value: loading || error ? '—' : `${series.length}`, label: 'Series' },
              { value: 'Free', label: 'To listen' },
            ]}
          />
        }
      />

      <section className="px-5 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-[1180px]">
          <div className="bg-sand/70 neu-inset sticky top-[88px] z-30 rounded-[34px] p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="lg:flex-1">
                <SearchBar value={inputQ} onChange={setInputQ} placeholder="Search lectures, scholars, series…" label="Search lectures" />
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearAll}
                  className="bg-cream neu-raised-sm text-ink hover:text-rose shrink-0 rounded-full px-5 py-3 text-[0.86rem] font-semibold transition-colors"
                >
                  Reset filters
                </button>
              )}
            </div>
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <p className="text-ink-muted mb-2 text-[0.7rem] font-semibold tracking-[0.14em] uppercase">Scholar</p>
                <FilterChips options={scholarChipOptions} active={urlScholar as any} onChange={(v) => updateParam('scholar', v as string)} allLabel="All scholars" />
              </div>
              <div>
                <p className="text-ink-muted mb-2 text-[0.7rem] font-semibold tracking-[0.14em] uppercase">Subject</p>
                <FilterChips options={subjectOptions} active={urlSubject as any} onChange={(v) => updateParam('subject', v as string)} allLabel="All subjects" />
              </div>
              <div>
                <p className="text-ink-muted mb-2 text-[0.7rem] font-semibold tracking-[0.14em] uppercase">Format</p>
                <FilterChips options={[{ value: 'Audio', label: 'Audio' }, { value: 'Video', label: 'Video' }]} active={format as any} onChange={(v) => {
                  const mapped = v === 'all' ? 'all' : v === 'Audio' ? 'audio' : 'video';
                  updateParam('type', mapped);
                }} allLabel="All formats" />
              </div>
              {hasActiveFilters && (
                <p className="text-ink-muted text-[0.74rem]">
                  Filters: {urlQ ? `“${urlQ}”` : ''} {urlScholar !== 'all' ? `· ${scholarBySlug.get(urlScholar)?.name ?? urlScholar}` : ''} {urlSubject !== 'all' ? `· ${subjectBySlug.get(urlSubject)?.name ?? urlSubject}` : ''} {format !== 'all' ? `· ${format}` : ''} <span className="text-ink-soft">— share this URL</span>
                </p>
              )}
            </div>
          </div>

          {loading ? (
            <>
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium">Searching lectures…</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
              </div>
            </>
          ) : error ? (
            <div className="mt-10 bg-cream neu-raised rounded-[24px] p-8 text-center">
              <p className="font-display text-ink text-[1.1rem] font-bold">Could not load lectures</p>
              <p className="text-ink-soft mt-2 text-[0.9rem]">{error}</p>
              <button onClick={() => window.location.reload()} className="bg-rose text-cream mt-6 rounded-full px-6 py-3 text-[0.9rem] font-semibold">Try again</button>
            </div>
          ) : (
            <>
              {/* Fase 5.5: screen readers hear the result of a filter without moving focus. */}
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium" role="status" aria-live="polite">
                {contents.length} lectures found · {series.length} series, {standalone.length} singles
              </p>

              {series.length > 0 && (
                <>
                  <h2 className="font-display text-ink mt-8 text-[1.35rem] font-extrabold tracking-[-0.02em]">Series & Playlists</h2>
                  <p className="text-ink-muted mt-1 text-[0.82rem]">A series gathers all its episodes — open the series to see them.</p>
                  <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {series.map((s) => (
                      <SeriesCard key={s.id} s={s} />
                    ))}
                  </div>
                </>
              )}

              {standalone.length > 0 && (
                <>
                  <h2 className="font-display text-ink mt-10 text-[1.35rem] font-extrabold tracking-[-0.02em]">{series.length ? 'Single lectures' : 'Lectures'}</h2>
                  <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {standalone.map((c) => (
                      <LectureCard key={c.id} c={c} />
                    ))}
                  </div>
                </>
              )}

              {contents.length === 0 && (
                <div className="mt-10">
                  {/* Fase 5.5: distinguish "your filters exclude everything" from "nothing published yet". */}
                  {hasActiveFilters ? (
                    <EmptyState title="No lectures match" body="Try a different search term, scholar, subject or format. Your filters are shareable via the URL." />
                  ) : (
                    <EmptyState title="No lectures yet" body="Nothing has been published yet. Lectures and series appear here as soon as they are added." />
                  )}
                  <div className="mt-6 flex justify-center">
                    {hasActiveFilters && (
                      <button onClick={clearAll} className="bg-rose text-cream rounded-full px-6 py-3 text-[0.9rem] font-semibold">Clear all filters</button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
