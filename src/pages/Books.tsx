import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { usePageMeta } from '../lib/usePageMeta';
import { EmptyState, StatRow } from '../components/ui';
import { groupByCollection } from '@/lib/series';
// Discovery steps D0/D2: the same shared cards, paging, filter panel and list states as /lectures.
import { BookCard, CardSkeleton, CollectionCard } from '@/components/cards';
import { Rail, RAIL_SLOT } from '@/components/Rail';
import LibraryFilters from '@/components/LibraryFilters';
import { CardGridSkeleton, ListErrorCard, LoadMore } from '@/components/ListStates';
import { usePagedContentQuery, LIBRARY_PAGE_SIZE } from '@/lib/usePagedContentQuery';
import { useFilterOptions } from '@/lib/useFilterOptions';

/** The newest strip on the page shows this many items, and only when the shelf is bigger than that. */
const NEWEST_RAIL = 12;

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

  // The book/document distinction stays exactly where it was: it is the shelf's own format filter.
  const typeFilter = useMemo(() => {
    if (urlType === 'book' || urlType === 'document') return urlType;
    return 'all';
  }, [urlType]);

  const { scholarOptions, subjectOptions, scholarBySlug, subjectBySlug } = useFilterOptions();

  const queryFilters = useMemo(
    () => ({ q: searchParams.get('q') ?? undefined, scholar: urlScholar, subject: urlSubject, type: urlType }),
    [searchParams, urlScholar, urlSubject, urlType],
  );

  // D2: real paging instead of the silent `limit: 100` (audit A5).
  const { data: contents, total, loading, loadingMore, error, loadMore, retry, hasMore } = usePagedContentQuery(queryFilters, {
    shelf: 'books',
    errorMessage: 'Failed to load books',
  });

  const newest = usePagedContentQuery(queryFilters, {
    shelf: 'books',
    pageSize: NEWEST_RAIL,
    sort: 'publishedAt:desc',
    // Only asked for once the shelf turns out to be bigger than one page of the grid: a strip that
    // repeats the list underneath it would add nothing (and would cost a request).
    enabled: total > LIBRARY_PAGE_SIZE,
  });

  const { series, standalone } = useMemo(() => groupByCollection(contents), [contents]);
  const hasActiveFilters = Boolean(urlQ) || urlScholar !== 'all' || urlSubject !== 'all' || typeFilter !== 'all';
  const showNewestRail = newest.total > LIBRARY_PAGE_SIZE && newest.data.length > 0;

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

  function clearAll() {
    setInputQ('');
    setSearchParams(new URLSearchParams(), { replace: false });
  }

  const activeSummary = (
    <>
      Filters: {urlQ ? `“${urlQ}”` : ''} {urlScholar !== 'all' ? `· ${scholarBySlug.get(urlScholar)?.name ?? urlScholar}` : ''}{' '}
      {urlSubject !== 'all' ? `· ${subjectBySlug.get(urlSubject)?.name ?? urlSubject}` : ''} {typeFilter !== 'all' ? `· ${typeFilter}` : ''}{' '}
      <span className="text-ink-soft">— share this URL</span>
    </>
  );

  return (
    <>
      <PageHeader
        eyebrow="Read & Reflect"
        title="Books"
        intro="Classical texts and contemporary works — search by title, subject or scholar. Filters are shareable via the URL."
        meta={
          <StatRow
            items={[
              { value: loading || error ? '—' : `${total}`, label: 'Items' },
              { value: loading || error ? '—' : `${series.length}`, label: 'Collections in view' },
              { value: 'Free', label: 'To read' },
            ]}
          />
        }
      />

      <section className="px-5 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-[1180px]">
          <LibraryFilters
            search={inputQ}
            onSearch={setInputQ}
            searchPlaceholder="Search titles, authors, descriptions…"
            searchLabel="Search books"
            activeSummary={activeSummary}
            hasActiveFilters={hasActiveFilters}
            onReset={clearAll}
            groups={[
              { id: 'scholar', label: 'Scholar', options: scholarOptions, active: urlScholar, allLabel: 'All scholars', onChange: (v) => updateParam('scholar', v) },
              { id: 'subject', label: 'Subject', options: subjectOptions, active: urlSubject, allLabel: 'All subjects', onChange: (v) => updateParam('subject', v) },
              // Audit B3: the same control is called "Format" on both shelves now (it was "Edition" here).
              { id: 'format', label: 'Format', options: formatOptions, active: typeFilter, allLabel: 'All formats', onChange: (v) => updateParam('type', v) },
            ]}
          />

          {loading ? (
            <>
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium">Searching books…</p>
              <CardGridSkeleton count={6} media="book" />
            </>
          ) : error && contents.length === 0 ? (
            <ListErrorCard title="Could not load books" onRetry={retry} retrying={loading} />
          ) : (
            <>
              {/* Fase 5.5: screen readers hear the result of a filter without moving focus.
                  D2: honest total from `pagination.total`, plus what is really on screen (audit A5). */}
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium" role="status" aria-live="polite">
                {total} books found{hasMore ? ` · showing ${contents.length} of ${total}` : ''} · {series.length} collections, {standalone.length} singles in view
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
                  skeleton={<CardSkeleton media="book" />}
                  itemClassName={RAIL_SLOT.book}
                >
                  {newest.data.map((c) => (
                    <BookCard key={c.id} c={c} />
                  ))}
                </Rail>
              )}

              {series.length > 0 && (
                <Rail
                  className="mt-12"
                  bleed={false}
                  title="Collections"
                  subtitle={`Grouped from the ${contents.length} items loaded in this view — open a collection to see its titles`}
                  items={series.length}
                  skeleton={<CardSkeleton media="book" />}
                  itemClassName={RAIL_SLOT.book}
                >
                  {series.map((s) => (
                    <CollectionCard key={s.id} s={s} />
                  ))}
                </Rail>
              )}

              {standalone.length > 0 && (
                <>
                  <h2 className="font-display text-ink mt-12 text-[1.35rem] font-extrabold tracking-[-0.02em]">{series.length ? 'Single books' : 'Books'}</h2>
                  <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {standalone.map((c) => (
                      <BookCard key={c.id} c={c} />
                    ))}
                  </div>
                </>
              )}

              {error && contents.length > 0 && (
                <p className="text-rose mt-8 text-center text-[0.86rem] font-medium" role="status">
                  Could not load more — {''}
                  <button type="button" onClick={retry} className="underline">
                    try again
                  </button>
                </p>
              )}

              {hasMore && !error && <LoadMore shown={contents.length} total={total} noun="book" loading={loadingMore} onClick={loadMore} />}

              {contents.length === 0 && (
                <div className="mt-10">
                  {/* Fase 5.5: with no filters set, "try another search term" was advice about
                      filters the visitor had not applied yet — an empty library needs its own text. */}
                  {hasActiveFilters ? (
                    <EmptyState title="No books match" body="Try a different search term, scholar, subject or format. Your filters are shareable via the URL." />
                  ) : (
                    <EmptyState title="No books yet" body="The book shelf is still empty. Titles appear here as soon as they are published." />
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
