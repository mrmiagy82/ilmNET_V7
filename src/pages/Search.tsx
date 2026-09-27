/**
 * `/search` — one search box for the whole library (Discovery step D4, audit A6).
 *
 * Before D4 a visitor who wanted "Tahawiyyah" had to guess first whether it was a lecture, a book or a
 * series: search existed only inside the three sections (`/lectures`, `/books`, `/scholars`) and the
 * header had no search at all. There was no cross-type result view.
 *
 * What this page is: one field, one result view, grouped by what the answer *is* —
 *
 *   - **Items** — the existing `q` search on `/api/contents`, plus the filters that endpoint really
 *     supports (`type`, `scholar`, `subject`), paged with the D2 hook and rendered with the D0 cards;
 *   - **Scholars / Subjects** — matched against the published reference lists, which the existing API
 *     returns in full in one request each. These two endpoints take no search parameter, so the match
 *     happens here, in the browser, over the *complete* published list.
 *
 * Honesty rules that shape the copy (AGENTS.md §2, audit A5/B5):
 *   - no number on this page is invented. The item count is the API's own `pagination.total`; the
 *     scholar and subject counts are "N of M" over the lists the API returned — never a percentage, a
 *     relevance score or a "top result";
 *   - a group whose request failed says so and offers a retry, instead of quietly rendering an empty
 *     section that would read as "nothing exists";
 *   - the page states how much of the item list is on screen ("showing 24 of 210") and loads the rest
 *     on request, exactly like the two library shelves;
 *   - there is no popularity, trending or "did you mean": those signals do not exist in this database.
 *
 * The URL is the state (`q`, `scholar`, `subject`, `type`), so a result view can be shared or
 * bookmarked, and the canonical URL of the page is `/search` itself — the same rule the filtered
 * library views follow.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { usePageMeta } from '../lib/usePageMeta';
import { EmptyState, StatRow } from '../components/ui';
import { ContentCard, ScholarTile, SeriesCard, CollectionCard, SubjectTile, isBookType } from '@/components/cards';
import { Rail, RAIL_SLOT } from '@/components/Rail';
import LibraryFilters from '@/components/LibraryFilters';
import { CardGridSkeleton, ListErrorCard, LoadMore } from '@/components/ListStates';
import { usePagedContentQuery } from '@/lib/usePagedContentQuery';
import { usePublicScholars, usePublicSubjects } from '@/lib/usePublicReference';
import { groupByCollection } from '@/lib/series';
import { SHELF_TYPES } from '@/lib/contentQuery';
import type { BackendScholar, BackendSubject } from '@/lib/api';

/** How many matching scholars/subjects one search shows before it says "N of M". */
const GROUP_CAP = 12;

/** The `type` values the Format chips put in the URL — words a visitor can read. */
const TYPE_LECTURES = 'lectures';
const TYPE_BOOKS = 'books';

/**
 * URL `type` → API `type`. The two shelf words map onto the same multi-value filters the shelves use
 * (`typeFilterToApi`), and any other value is passed through unchanged, so a hand-written URL with the
 * raw API values ('audio', 'document', …) keeps working instead of erroring.
 */
function apiType(type: string): string | undefined {
  if (type === TYPE_LECTURES) return SHELF_TYPES.lectures ?? undefined;
  if (type === TYPE_BOOKS) return SHELF_TYPES.books ?? undefined;
  return type && type !== 'all' ? type : undefined;
}

/** Case-insensitive "does this text contain the query" over the fields a visitor can see. */
function matches(q: string, ...fields: (string | null | undefined)[]): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => (f ?? '').toLowerCase().includes(needle));
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQ = searchParams.get('q') ?? '';
  const urlScholar = searchParams.get('scholar') ?? 'all';
  const urlSubject = searchParams.get('subject') ?? 'all';
  const urlType = searchParams.get('type') ?? 'all';

  // The field is local while typing and lands in the URL after a pause — the same 340 ms contract the
  // two library shelves use (D2), so all three search surfaces feel identical. `replace: true` keeps
  // one keystroke burst out of the browser history.
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
    // D4 (found while checking the new search page): the URL values belong in this dependency list.
    // React Router applies `setSearchParams` as a transition, so there is a real render in between where
    // the field is already empty but `searchParams` still holds the old query. That render scheduled a
    // keystroke timer whose closure kept the *old* URL; 340 ms later it wrote those old parameters back
    // minus `q`. "Reset filters" therefore undid itself — on `/lectures?q=x&subject=y` the reset left
    // `?subject=y` behind. Re-running the effect when the URL changes clears that timer.
  }, [inputQ, urlQ, searchParams, setSearchParams]);

  const scholars = usePublicScholars({ errorMessage: 'Could not load scholars' });
  const subjects = usePublicSubjects({ errorMessage: 'Could not load fields' });

  const scholarOptions = useMemo(
    () => scholars.data.map((s) => ({ value: s.slug, label: s.name })),
    [scholars.data],
  );
  const subjectOptions = useMemo(
    () => subjects.data.map((s) => ({ value: s.slug, label: s.name })),
    [subjects.data],
  );
  const scholarBySlug = useMemo(() => new Map<string, BackendScholar>(scholars.data.map((s) => [s.slug, s])), [scholars.data]);
  const subjectBySlug = useMemo(() => new Map<string, BackendSubject>(subjects.data.map((s) => [s.slug, s])), [subjects.data]);

  const hasQuery = Boolean(urlQ.trim());
  const hasChips = urlScholar !== 'all' || urlSubject !== 'all' || urlType !== 'all';
  const searching = hasQuery || hasChips;

  const queryFilters = useMemo(
    () => ({ q: urlQ || undefined, scholar: urlScholar, subject: urlSubject, type: apiType(urlType) }),
    [urlQ, urlScholar, urlSubject, urlType],
  );

  // The whole-library shelf with the D2 paging hook: 24 items per page, `pagination.total` as the
  // count, "Load more" for the rest. Nothing is fetched until the visitor has actually asked for
  // something — an empty `/search` must not pull the library down.
  const items = usePagedContentQuery(queryFilters, {
    shelf: 'library',
    errorMessage: 'Could not search the library',
    enabled: searching,
  });

  const { series } = useMemo(() => groupByCollection(items.data), [items.data]);

  // The two reference groups. `q` matches what a visitor can read on the tile; when a chip narrows the
  // search, the group follows that choice so the page cannot contradict its own filter.
  const scholarMatches = useMemo(() => {
    if (!searching) return [];
    const pool = urlScholar !== 'all' ? scholars.data.filter((s) => s.slug === urlScholar) : scholars.data;
    return pool.filter((s) => matches(urlQ, s.name, s.bio, s.specialty?.name));
  }, [searching, scholars.data, urlQ, urlScholar]);

  const subjectMatches = useMemo(() => {
    if (!searching) return [];
    const pool = urlSubject !== 'all' ? subjects.data.filter((s) => s.slug === urlSubject) : subjects.data;
    return pool.filter((s) => matches(urlQ, s.name, s.description, s.group));
  }, [searching, subjects.data, urlQ, urlSubject]);

  const nothingFound =
    searching &&
    !items.loading &&
    !items.error &&
    !scholars.loading &&
    !scholars.error &&
    !subjects.loading &&
    !subjects.error &&
    items.total === 0 &&
    scholarMatches.length === 0 &&
    subjectMatches.length === 0;

  const searchTitle = urlQ.trim() ? `Search: ${urlQ.trim()}` : 'Search';
  usePageMeta({
    title: searchTitle,
    description:
      'Search the whole ilmNet library at once — lectures, books, series, scholars and subjects. Counts and results come straight from the library itself.',
    path: '/search',
    // Fase 5.5 rule, applied here: never block indexing of a page that renders fine, but do not offer
    // search engines a confirmed empty result as a landing page.
    noindex: nothingFound,
  });

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
      Search: {urlQ ? `“${urlQ}”` : ''} {urlScholar !== 'all' ? `· ${scholarBySlug.get(urlScholar)?.name ?? urlScholar}` : ''}{' '}
      {urlSubject !== 'all' ? `· ${subjectBySlug.get(urlSubject)?.name ?? urlSubject}` : ''}{' '}
      {urlType !== 'all' ? `· ${urlType === TYPE_LECTURES ? 'Lectures' : urlType === TYPE_BOOKS ? 'Books' : urlType}` : ''}{' '}
      <span className="text-ink-soft">— share this URL</span>
    </>
  );

  // Only named when the visitor actually chose a format: "36 items match · everything" is noise.
  const typeLabel = urlType === TYPE_LECTURES ? 'Lectures' : urlType === TYPE_BOOKS ? 'Books' : '';

  return (
    <>
      <PageHeader
        eyebrow="Search"
        title={urlQ.trim() ? `Results for “${urlQ.trim()}”` : 'Search the library'}
        intro="One field for everything ilmNet holds — lectures, books, series, scholars and subjects. Narrow it by format, scholar or subject; your search lives in the URL, so a result view can be shared or bookmarked."
        meta={
          <StatRow
            items={[
              { value: searching && !items.loading && !items.error ? `${items.total}` : '—', label: 'Items match' },
              { value: searching && !scholars.loading && !scholars.error ? `${scholarMatches.length}` : '—', label: 'Scholars' },
              { value: searching && !subjects.loading && !subjects.error ? `${subjectMatches.length}` : '—', label: 'Subjects' },
            ]}
          />
        }
      />

      <section className="px-5 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-[1180px]">
          <LibraryFilters
            search={inputQ}
            onSearch={setInputQ}
            searchPlaceholder="Search lectures, books, series, scholars, subjects…"
            searchLabel="Search the whole library"
            activeSummary={activeSummary}
            hasActiveFilters={searching}
            onReset={clearAll}
            groups={[
              {
                id: 'type',
                label: 'Format',
                options: [
                  { value: TYPE_LECTURES, label: 'Lectures' },
                  { value: TYPE_BOOKS, label: 'Books' },
                ],
                active: urlType,
                allLabel: 'Everything',
                onChange: (v) => updateParam('type', v),
              },
              { id: 'scholar', label: 'Scholar', options: scholarOptions, active: urlScholar, allLabel: 'All scholars', onChange: (v) => updateParam('scholar', v) },
              { id: 'subject', label: 'Subject', options: subjectOptions, active: urlSubject, allLabel: 'All subjects', onChange: (v) => updateParam('subject', v) },
            ]}
          />

          {/* Nothing asked yet: a real prompt, real destinations, and no invented "popular searches". */}
          {!searching && (
            <div className="mt-10">
              <div className="bg-cream neu-raised rounded-[28px] p-8 text-center">
                <p className="font-display text-ink text-[1.15rem] font-bold">Search the whole library at once</p>
                <p className="text-ink-soft mx-auto mt-3 max-w-[52ch] text-[0.94rem] leading-relaxed">
                  Type a title, a scholar's name or part of a subject. The results are grouped by what they are — items,
                  scholars and subjects — and every count on this page comes from the library itself.
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-3">
                  <Link to="/lectures" className="bg-cream neu-raised-sm text-ink rounded-full px-6 py-3 text-[0.9rem] font-semibold">
                    Browse lectures
                  </Link>
                  <Link to="/books" className="bg-cream neu-raised-sm text-ink rounded-full px-6 py-3 text-[0.9rem] font-semibold">
                    Browse books
                  </Link>
                  <Link to="/scholars" className="bg-cream neu-raised-sm text-ink rounded-full px-6 py-3 text-[0.9rem] font-semibold">
                    Browse scholars
                  </Link>
                  <Link to="/subjects" className="bg-cream neu-raised-sm text-ink rounded-full px-6 py-3 text-[0.9rem] font-semibold">
                    Browse subjects
                  </Link>
                </div>
              </div>
            </div>
          )}

          {searching && items.loading && (
            <>
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium">Searching the library…</p>
              <CardGridSkeleton count={6} />
            </>
          )}

          {searching && items.error && items.data.length === 0 && (
            <ListErrorCard title="Could not search the library" onRetry={items.retry} retrying={items.loading} />
          )}

          {searching && !items.loading && (!items.error || items.data.length > 0) && (
            <>
              {/* The same honest arithmetic as the library shelves: the API's total first, then how much
                  of it is really on screen. */}
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium" role="status" aria-live="polite">
                {items.total} {items.total === 1 ? 'item' : 'items'} match
                {hasQuery ? ` “${urlQ.trim()}”` : ''}
                {typeLabel ? ` · ${typeLabel}` : ''}
                {items.hasMore ? ` · showing ${items.data.length} of ${items.total}` : ''}
                {series.length > 0 ? ` · ${series.length} series in view` : ''}
              </p>

              {series.length > 0 && (
                <Rail
                  className="mt-12"
                  bleed={false}
                  title="Series & collections"
                  subtitle={`Grouped from the ${items.data.length} items loaded in this view — open one to see everything it contains`}
                  items={series.length}
                  itemClassName={RAIL_SLOT.media}
                >
                  {series.map((s) =>
                    s.items[0] && isBookType(s.items[0].type) ? <CollectionCard key={s.id} s={s} /> : <SeriesCard key={s.id} s={s} />,
                  )}
                </Rail>
              )}

              <h2 className="font-display text-ink mt-12 text-[1.35rem] font-extrabold tracking-[-0.02em]">Items</h2>
              {items.data.length > 0 ? (
                <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {items.data.map((c) => (
                    <ContentCard key={c.id} c={c} />
                  ))}
                </div>
              ) : (
                <p className="text-ink-soft mt-4 text-[0.92rem]">
                  No published items match these filters. The scholars and subjects below are matched on their own names.
                </p>
              )}

              {/* A failure while loading more keeps the list: only this line reports it (D2/D11). */}
              {items.error && items.data.length > 0 && (
                <p className="text-rose mt-8 text-center text-[0.86rem] font-medium" role="status">
                  Could not load more —{' '}
                  <button type="button" onClick={items.retry} className="underline">
                    try again
                  </button>
                </p>
              )}

              {items.hasMore && !items.error && (
                <LoadMore shown={items.data.length} total={items.total} noun="item" loading={items.loadingMore} onClick={items.loadMore} />
              )}

              {/* ── Scholars ────────────────────────────────────────────────────────────────────── */}
              <h2 className="font-display text-ink mt-14 text-[1.35rem] font-extrabold tracking-[-0.02em]">Scholars</h2>
              {scholars.loading ? (
                <p className="text-ink-muted mt-4 text-[0.86rem] font-medium">Loading scholars…</p>
              ) : scholars.error ? (
                <p className="text-ink-soft mt-4 text-[0.92rem]">
                  Could not load the scholars —{' '}
                  <button type="button" onClick={scholars.retry} className="text-rose underline">
                    try again
                  </button>
                </p>
              ) : scholarMatches.length > 0 ? (
                <>
                  <p className="text-ink-muted mt-3 text-[0.84rem] font-medium">
                    {scholarMatches.length} of {scholars.total} published scholars match
                    {scholarMatches.length > GROUP_CAP ? ` — showing the first ${GROUP_CAP}` : ''}
                  </p>
                  <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {scholarMatches.slice(0, GROUP_CAP).map((s) => (
                      <ScholarTile key={s.id} s={s} to={`/scholars/${encodeURIComponent(s.slug)}`} linkLabel="View work" />
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-ink-soft mt-4 text-[0.92rem]">
                  No published scholar matches {hasQuery ? `“${urlQ.trim()}”` : 'these filters'}.
                </p>
              )}

              {/* ── Subjects ────────────────────────────────────────────────────────────────────── */}
              <h2 className="font-display text-ink mt-14 text-[1.35rem] font-extrabold tracking-[-0.02em]">Subjects</h2>
              {subjects.loading ? (
                <p className="text-ink-muted mt-4 text-[0.86rem] font-medium">Loading subjects…</p>
              ) : subjects.error ? (
                <p className="text-ink-soft mt-4 text-[0.92rem]">
                  Could not load the subjects —{' '}
                  <button type="button" onClick={subjects.retry} className="text-rose underline">
                    try again
                  </button>
                </p>
              ) : subjectMatches.length > 0 ? (
                <>
                  <p className="text-ink-muted mt-3 text-[0.84rem] font-medium">
                    {subjectMatches.length} of {subjects.total} published subjects match
                    {subjectMatches.length > GROUP_CAP ? ` — showing the first ${GROUP_CAP}` : ''}
                  </p>
                  <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {subjectMatches.slice(0, GROUP_CAP).map((s) => (
                      <SubjectTile key={s.id} s={s} />
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-ink-soft mt-4 text-[0.92rem]">
                  No published subject matches {hasQuery ? `“${urlQ.trim()}”` : 'these filters'}.
                </p>
              )}

              {nothingFound && (
                <div className="mt-12">
                  <EmptyState
                    title={hasQuery ? `Nothing matches “${urlQ.trim()}”` : 'Nothing matches these filters'}
                    body="Nothing in the published library matches this search — not a lecture, a book, a series, a scholar or a subject. Try a shorter word, a scholar's name, or clear the filters."
                  />
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button onClick={clearAll} className="bg-rose text-cream rounded-full px-6 py-3 text-[0.9rem] font-semibold">
                      Clear search
                    </button>
                    <Link to="/subjects" className="bg-cream neu-raised-sm text-ink rounded-full px-6 py-3 text-[0.9rem] font-semibold">
                      Browse subjects instead
                    </Link>
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
