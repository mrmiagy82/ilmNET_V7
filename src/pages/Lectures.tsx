import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { usePageMeta } from '../lib/usePageMeta';
import { EmptyState, StatRow } from '../components/ui';
import { groupByCollection } from '@/lib/series';
// Discovery steps D0/D2: cards, query logic, paging, filter panel and list states all live in one
// shared place instead of in each page (audit D6 measured the drift this removes).
import { LectureCard, SeriesCard } from '@/components/cards';
import { Rail, RAIL_SLOT } from '@/components/Rail';
import LibraryFilters from '@/components/LibraryFilters';
import { CardGridSkeleton, ListErrorCard, LoadMore } from '@/components/ListStates';
import { usePagedContentQuery, LIBRARY_PAGE_SIZE } from '@/lib/usePagedContentQuery';
import { useFilterOptions } from '@/lib/useFilterOptions';

/** The newest strip on the page shows this many items, and only when the shelf is bigger than that. */
const NEWEST_RAIL = 12;

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

  const { scholarOptions, subjectOptions, scholarBySlug, subjectBySlug } = useFilterOptions();

  const queryFilters = useMemo(
    () => ({ q: searchParams.get('q') ?? undefined, scholar: urlScholar, subject: urlSubject, type: urlFormat }),
    [searchParams, urlScholar, urlSubject, urlFormat],
  );

  // D2: real paging. The page size replaces the silent `limit: 100` that made 101 published lectures
  // look like a complete library and made every counter under-report (audit A5).
  const { data: contents, total, loading, loadingMore, error, loadMore, retry, hasMore } = usePagedContentQuery(queryFilters, {
    shelf: 'lectures',
    errorMessage: 'Failed to load lectures',
  });

  // The newest strip asks the same shelf for its newest items, whatever the current filters are. It is
  // only rendered when the shelf holds more than one page (see `showNewestRail`): a strip that repeats
  // the list underneath it adds nothing.
  const newest = usePagedContentQuery(queryFilters, {
    shelf: 'lectures',
    pageSize: NEWEST_RAIL,
    sort: 'publishedAt:desc',
    // Only asked for once the shelf turns out to be bigger than one page of the grid: a strip that
    // repeats the list underneath it would add nothing (and would cost a request).
    enabled: total > LIBRARY_PAGE_SIZE,
  });

  const { series, standalone } = useMemo(() => groupByCollection(contents), [contents]);
  const hasActiveFilters = Boolean(urlQ) || urlScholar !== 'all' || urlSubject !== 'all' || format !== 'all';
  const showNewestRail = newest.total > LIBRARY_PAGE_SIZE && newest.data.length > 0;

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: false });
  }

  function clearAll() {
    setInputQ('');
    setSearchParams(new URLSearchParams(), { replace: false });
  }

  // The words after "Filters: …" — the same names the pages and cards use, never an id.
  const activeSummary = (
    <>
      Filters: {urlQ ? `“${urlQ}”` : ''} {urlScholar !== 'all' ? `· ${scholarBySlug.get(urlScholar)?.name ?? urlScholar}` : ''}{' '}
      {urlSubject !== 'all' ? `· ${subjectBySlug.get(urlSubject)?.name ?? urlSubject}` : ''} {format !== 'all' ? `· ${format}` : ''}{' '}
      <span className="text-ink-soft">— share this URL</span>
    </>
  );

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
              { value: loading || error ? '—' : `${series.length}`, label: 'Series in view' },
              { value: 'Free', label: 'To listen' },
            ]}
          />
        }
      />

      <section className="px-5 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-[1180px]">
          <LibraryFilters
            search={inputQ}
            onSearch={setInputQ}
            searchPlaceholder="Search lectures, scholars, series…"
            searchLabel="Search lectures"
            activeSummary={activeSummary}
            hasActiveFilters={hasActiveFilters}
            onReset={clearAll}
            groups={[
              { id: 'scholar', label: 'Scholar', options: scholarOptions, active: urlScholar, allLabel: 'All scholars', onChange: (v) => updateParam('scholar', v) },
              { id: 'subject', label: 'Subject', options: subjectOptions, active: urlSubject, allLabel: 'All subjects', onChange: (v) => updateParam('subject', v) },
              {
                id: 'format',
                label: 'Format',
                options: [
                  { value: 'Audio', label: 'Audio' },
                  { value: 'Video', label: 'Video' },
                ],
                active: format,
                allLabel: 'All formats',
                onChange: (v) => updateParam('type', v === 'all' ? 'all' : v === 'Audio' ? 'audio' : 'video'),
              },
            ]}
          />

          {loading ? (
            <>
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium">Searching lectures…</p>
              <CardGridSkeleton count={6} />
            </>
          ) : error && contents.length === 0 ? (
            <ListErrorCard title="Could not load lectures" onRetry={retry} retrying={loading} />
          ) : (
            <>
              {/* Fase 5.5: screen readers hear the result of a filter without moving focus.
                  D2: the first number is the API's own total, the second is what is really on screen —
                  the line no longer reports the loaded page as if it were the whole library (audit A5). */}
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium" role="status" aria-live="polite">
                {total} lectures found{hasMore ? ` · showing ${contents.length} of ${total}` : ''} · {series.length} series, {standalone.length} singles in view
              </p>

              {showNewestRail && (
                <Rail
                  className="mt-10"
                  bleed={false}
                  label="Recently added"
                  title="Newest first"
                  subtitle="The latest items in this view"
                  items={newest.data.length}
                  loading={newest.loading}
                  skeletonCount={4}
                  itemClassName={RAIL_SLOT.media}
                >
                  {newest.data.map((c) => (
                    <LectureCard key={c.id} c={c} />
                  ))}
                </Rail>
              )}

              {series.length > 0 && (
                <Rail
                  className="mt-12"
                  bleed={false}
                  title="Series & Playlists"
                  subtitle={`Grouped from the ${contents.length} items loaded in this view — open a series to see everything it contains`}
                  items={series.length}
                  itemClassName={RAIL_SLOT.media}
                >
                  {series.map((s) => (
                    <SeriesCard key={s.id} s={s} />
                  ))}
                </Rail>
              )}

              {standalone.length > 0 && (
                <>
                  <h2 className="font-display text-ink mt-12 text-[1.35rem] font-extrabold tracking-[-0.02em]">{series.length ? 'Single lectures' : 'Lectures'}</h2>
                  <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {standalone.map((c) => (
                      <LectureCard key={c.id} c={c} />
                    ))}
                  </div>
                </>
              )}

              {/* A failure while loading more keeps the list: only this line reports it (D2). */}
              {error && contents.length > 0 && (
                <p className="text-rose mt-8 text-center text-[0.86rem] font-medium" role="status">
                  Could not load more — {''}
                  <button type="button" onClick={retry} className="underline">
                    try again
                  </button>
                </p>
              )}

              {hasMore && !error && <LoadMore shown={contents.length} total={total} noun="lecture" loading={loadingMore} onClick={loadMore} />}

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
                      <button onClick={clearAll} className="bg-rose text-cream rounded-full px-6 py-3 text-[0.9rem] font-semibold">
                        Clear all filters
                      </button>
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
