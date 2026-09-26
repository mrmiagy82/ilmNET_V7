import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { usePageMeta } from '../lib/usePageMeta';
import { SearchBar, FilterChips, EmptyState, StatRow } from '../components/ui';
import { listPublicScholars, listPublicSubjects, type BackendScholar, type BackendSubject } from '@/lib/api';
import { groupByCollection } from '@/lib/series';
// Discovery step D0: the cards and the query logic live in one shared place now instead of in each page.
import { BookCard, CollectionCard, CardSkeleton } from '@/components/cards';
import { useContentQuery } from '@/lib/useContentQuery';

export default function Books() {
  usePageMeta({
    title: 'Books',
    description:
      'Classical texts and contemporary works in the ilmNet library — search by title, subject or scholar. Free to read, always linked to the original source.',
    path: '/books',
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const urlQ = searchParams.get('q') ?? '';
  const urlScholar = searchParams.get('scholar') ?? 'all';
  const urlSubject = searchParams.get('subject') ?? 'all';
  const urlType = searchParams.get('type') ?? 'all';

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

  const typeFilter = useMemo(() => {
    if (urlType === 'book' || urlType === 'document') return urlType;
    return 'all';
  }, [urlType]);

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

  // One shared query: same request as before (limit 100, type=book,document unless filtered), plus the
  // API's own `pagination.total` for counters.
  const { data: contents, total, loading, error } = useContentQuery(
    { q: searchParams.get('q') ?? undefined, scholar: urlScholar, subject: urlSubject, type: urlType },
    { shelf: 'books', errorMessage: 'Failed to load books' },
  );

  const subjectOptions = subjects.map((s) => ({ value: s.slug, label: s.name.replace(/ &.*/, '') }));
  const scholarChipOptions = scholars.map((s) => ({ value: s.slug, label: s.name }));
  const formatOptions = [
    { value: 'book', label: 'Books' },
    { value: 'document', label: 'Documents' },
  ];

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: false });
  }

  const hasActiveFilters = urlQ || urlScholar !== 'all' || urlSubject !== 'all' || typeFilter !== 'all';
  const { series, standalone } = useMemo(() => groupByCollection(contents), [contents]);

  function clearAll() {
    setInputQ('');
    setSearchParams(new URLSearchParams(), { replace: false });
  }

  return (
    <>
      <PageHeader
        eyebrow="Read & Reflect"
        title="Books"
        intro="Classical texts and contemporary works — search by title, subject or scholar. Filters are shareable via the URL."
        meta={<StatRow items={[{ value: loading || error ? '—' : `${total}`, label: 'Items' }, { value: loading || error ? '—' : `${series.length}`, label: 'Collections' }, { value: 'Free', label: 'To read' }]} />}
      />

      <section className="px-5 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-[1180px]">
          <div className="bg-sand/70 neu-inset sticky top-[88px] z-30 rounded-[34px] p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="lg:flex-1">
                <SearchBar value={inputQ} onChange={setInputQ} placeholder="Search titles, authors, descriptions…" label="Search books" />
              </div>
              {hasActiveFilters && (
                <button onClick={clearAll} className="bg-cream neu-raised-sm text-ink hover:text-rose shrink-0 rounded-full px-5 py-3 text-[0.86rem] font-semibold transition-colors">
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
                <p className="text-ink-muted mb-2 text-[0.7rem] font-semibold tracking-[0.14em] uppercase">Edition</p>
                <FilterChips options={formatOptions} active={typeFilter as any} onChange={(v) => updateParam('type', v as string)} allLabel="All formats" />
              </div>
              {hasActiveFilters && (
                <p className="text-ink-muted text-[0.74rem]">
                  Filters: {urlQ ? `“${urlQ}”` : ''} {urlScholar !== 'all' ? `· ${scholarBySlug.get(urlScholar)?.name ?? urlScholar}` : ''} {urlSubject !== 'all' ? `· ${subjectBySlug.get(urlSubject)?.name ?? urlSubject}` : ''} {typeFilter !== 'all' ? `· ${typeFilter}` : ''} <span className="text-ink-soft">— share this URL</span>
                </p>
              )}
            </div>
          </div>

          {loading ? (
            <>
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium">Searching books…</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} media="book" />)}
              </div>
            </>
          ) : error ? (
            <div className="mt-10 bg-cream neu-raised rounded-[24px] p-8 text-center">
              <p className="font-display text-ink text-[1.1rem] font-bold">Could not load books</p>
              <p className="text-ink-soft mt-2 text-[0.9rem]">{error}</p>
              <button onClick={() => window.location.reload()} className="bg-rose text-cream mt-6 rounded-full px-6 py-3 text-[0.9rem] font-semibold">Try again</button>
            </div>
          ) : (
            <>
              {/* Fase 5.5: screen readers hear the result of a filter without moving focus. */}
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium" role="status" aria-live="polite">
                {contents.length} books found · {series.length} collections, {standalone.length} singles
              </p>

              {series.length > 0 && (
                <>
                  <h2 className="font-display text-ink mt-8 text-[1.35rem] font-extrabold tracking-[-0.02em]">Collections</h2>
                  <p className="text-ink-muted mt-1 text-[0.82rem]">A collection gathers all its titles — open the collection to see the books.</p>
                  <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {series.map((s) => (
                      <CollectionCard key={s.id} s={s} />
                    ))}
                  </div>
                </>
              )}

              {standalone.length > 0 && (
                <>
                  <h2 className="font-display text-ink mt-10 text-[1.35rem] font-extrabold tracking-[-0.02em]">{series.length ? 'Single books' : 'Books'}</h2>
                  <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {standalone.map((c) => (
                      <BookCard key={c.id} c={c} />
                    ))}
                  </div>
                </>
              )}

              {contents.length === 0 && (
                <div className="mt-10">
                  {/* Fase 5.5: with no filters set, "try another search term" was advice about
                      filters the visitor had not applied yet — an empty library needs its own text. */}
                  {hasActiveFilters ? (
                    <EmptyState title="No books match" body="Try a different search term, scholar, subject or edition. Your filters are shareable via the URL." />
                  ) : (
                    <EmptyState title="No books yet" body="The book shelf is still empty. Titles appear here as soon as they are published." />
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
