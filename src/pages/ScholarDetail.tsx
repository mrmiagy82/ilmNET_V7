/**
 * `/scholars/:id` — a scholar's own page (Discovery step D3, audit A2).
 *
 * Before D3 a scholar could only be *listed*: the tile's "View work" pointed at the unfiltered lecture
 * list, so opening a scholar dropped the scholar. This page is the destination that was missing.
 *
 * Two things are deliberately kept apart:
 *
 *   - **identity** (name, initials, accent, bio, specialty) comes from `GET /api/scholars/:id`, the one
 *     endpoint that carries it. The hub (`/scholars`) does *not* call it — the plan's check for D3 — and
 *     a 404 here is a real "this scholar does not exist", so there is no list-scanning fallback
 *     (audit A7);
 *   - **work** comes from `GET /api/contents?scholar=<slug>` through the same paging hook the library
 *     pages use, so every number on this page is `pagination.total` and every list can be paged. No
 *     count is ever derived from what happens to be loaded.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { usePageMeta } from '../lib/usePageMeta';
import { EmptyState, StatRow } from '../components/ui';
import { LectureCard, BookCard, SeriesCard, CollectionCard, TileSkeleton } from '@/components/cards';
import { Rail, RAIL_SLOT, SectionHeading } from '@/components/Rail';
import { CardGridSkeleton, ListErrorCard, LoadMore } from '@/components/ListStates';
import { usePagedContentQuery, LIBRARY_PAGE_SIZE } from '@/lib/usePagedContentQuery';
import { groupByCollection } from '@/lib/series';
import { getPublicScholar, type BackendScholar } from '@/lib/api';

/** The newest strip on the page shows this many items, and only when the body of work is bigger. */
const NEWEST_RAIL = 12;

export default function ScholarDetail() {
  const { id } = useParams<{ id: string }>();
  const decoded = id ? decodeURIComponent(id) : '';

  const [scholar, setScholar] = useState<BackendScholar | null>(null);
  const [identityState, setIdentityState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!decoded) return;
    let alive = true;
    setIdentityState('loading');
    getPublicScholar(decoded)
      .then((res) => {
        if (!alive) return;
        setScholar(res.data);
        setIdentityState('ready');
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const status = (e as { status?: number })?.status;
        setIdentityState(status === 404 ? 'missing' : 'error');
      });
    return () => {
      alive = false;
    };
  }, [decoded, nonce]);

  usePageMeta({
    title: scholar?.name ?? 'Scholar',
    description: scholar?.bio ?? undefined,
    path: decoded ? `/scholars/${encodeURIComponent(decoded)}` : '',
    noindex: identityState === 'missing' || identityState === 'error',
  });

  // `scholar=` accepts an id, a slug or a name, so the work list can start before the identity lands.
  const work = usePagedContentQuery({ scholar: decoded }, { shelf: 'library', errorMessage: 'Failed to load this scholar’s work' });

  // The strip repeats what the grid below shows, so it is only fetched when the body of work is bigger
  // than one page (the same rule the library pages use since D2).
  const newest = usePagedContentQuery(
    { scholar: decoded },
    { shelf: 'library', pageSize: NEWEST_RAIL, sort: 'publishedAt:desc', enabled: work.total > LIBRARY_PAGE_SIZE },
  );

  const { series, standalone } = useMemo(() => groupByCollection(work.data), [work.data]);
  const showNewestRail = newest.total > LIBRARY_PAGE_SIZE && newest.data.length > 0;

  if (identityState === 'loading') {
    return (
      <>
        <PageHeader eyebrow="Scholar" title="Loading…" intro="Fetching this scholar." />
        <section className="px-5 pb-24 sm:px-6">
          <div className="mx-auto grid max-w-[1180px] gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <TileSkeleton key={i} />
            ))}
          </div>
        </section>
      </>
    );
  }

  if (identityState !== 'ready' || !scholar) {
    return (
      <>
        <PageHeader
          eyebrow="Scholar"
          title={identityState === 'error' ? 'Could not load this scholar' : 'Not found'}
          intro={
            identityState === 'error'
              ? 'The library could not be reached just now. This is usually temporary.'
              : 'This scholar does not exist (any more) in the published library.'
          }
        />
        <section className="px-5 pb-24 sm:px-6">
          <div className="mx-auto max-w-[1180px]">
            <div className="bg-cream neu-raised rounded-[24px] p-8 text-center">
              <p className="text-ink-muted text-[0.9rem]">Every item on ilmNet is traced back to its teacher.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {identityState === 'error' && (
                  <button onClick={() => setNonce((n) => n + 1)} className="bg-rose text-cream rounded-full px-6 py-3 text-[0.9rem] font-semibold">
                    Try again
                  </button>
                )}
                <Link to="/scholars" className="bg-cream neu-raised-sm text-ink rounded-full px-6 py-3 text-[0.9rem] font-semibold">
                  All scholars
                </Link>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  const body = (
    <section className="px-5 pb-24 sm:px-6 lg:pb-32">
      <div className="mx-auto max-w-[1180px]">
        {work.loading ? (
          <>
            <p className="text-ink-muted mt-8 text-[0.86rem] font-medium">Loading work…</p>
            <CardGridSkeleton count={6} />
          </>
        ) : work.error && work.data.length === 0 ? (
          <ListErrorCard title="Could not load this scholar’s work" onRetry={work.retry} retrying={work.loading} />
        ) : (
          <>
            <p className="text-ink-muted mt-8 text-[0.86rem] font-medium" role="status" aria-live="polite">
              {work.total} {work.total === 1 ? 'item' : 'items'} by {scholar.name}
              {work.hasMore ? ` · showing ${work.data.length} of ${work.total}` : ''}
            </p>

            {showNewestRail && (
              <Rail
                className="mt-10"
                bleed={false}
                label="Recently added"
                title="Newest first"
                subtitle={`The newest work by ${scholar.name}`}
                items={newest.data.length}
                loading={newest.loading}
                skeletonCount={4}
                itemClassName={RAIL_SLOT.media}
              >
                {newest.data.map((c) => (c.type === 'book' || c.type === 'document' ? <BookCard key={c.id} c={c} /> : <LectureCard key={c.id} c={c} />))}
              </Rail>
            )}

            {series.length > 0 && (
              <Rail
                className="mt-12"
                bleed={false}
                title="Series & collections"
                subtitle={`Grouped from the ${work.data.length} items loaded in this view — open one to see everything it contains`}
                items={series.length}
                itemClassName={RAIL_SLOT.media}
              >
                {series.map((s) => (s.items[0] && (s.items[0].type === 'book' || s.items[0].type === 'document') ? <CollectionCard key={s.id} s={s} /> : <SeriesCard key={s.id} s={s} />))}
              </Rail>
            )}

            {standalone.length > 0 && (
              <>
                <SectionHeading className="mt-14" label="Library" title={series.length ? 'Single items' : 'Work'} />
                <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {standalone.map((c) => (c.type === 'book' || c.type === 'document' ? <BookCard key={c.id} c={c} /> : <LectureCard key={c.id} c={c} />))}
                </div>
              </>
            )}

            {work.error && work.data.length > 0 && (
              <p className="text-rose mt-8 text-center text-[0.86rem] font-medium" role="status">
                Could not load more —{' '}
                <button type="button" onClick={work.retry} className="underline">
                  try again
                </button>
              </p>
            )}

            {work.hasMore && !work.error && <LoadMore shown={work.data.length} total={work.total} noun="item" loading={work.loadingMore} onClick={work.loadMore} />}

            {work.data.length === 0 && (
              <div className="mt-10">
                <EmptyState
                  title={`Nothing published by ${scholar.name} yet`}
                  body="This scholar is in the library, but no published work is linked to them yet. Everything published under this name will appear here."
                />
              </div>
            )}
          </>
        )}

        <div className="border-line/70 mt-16 flex flex-wrap items-center gap-3 border-t pt-10">
          {/* The shelf with this filter already existed (D2) — a real destination, not a new page. */}
          <Link
            to={`/lectures?scholar=${encodeURIComponent(scholar.slug)}`}
            className="bg-rose text-cream lift-sm inline-flex items-center gap-2 rounded-full px-6 py-3 text-[0.9rem] font-semibold shadow-[10px_14px_30px_rgba(204,58,99,0.24)]"
          >
            {scholar.name} in the lecture shelf <span aria-hidden="true">→</span>
          </Link>
          <Link
            to={`/books?scholar=${encodeURIComponent(scholar.slug)}`}
            className="bg-cream neu-raised-sm text-ink lift-sm inline-flex items-center gap-2 rounded-full px-6 py-3 text-[0.9rem] font-semibold"
          >
            {scholar.name} in the book shelf <span aria-hidden="true">→</span>
          </Link>
          <Link
            to="/scholars"
            className="text-ink-soft hover:text-rose inline-flex items-center gap-2 rounded-full px-4 py-3 text-[0.9rem] font-semibold transition-colors"
          >
            All scholars
          </Link>
        </div>
      </div>
    </section>
  );

  return (
    <>
      <PageHeader
        eyebrow={scholar.specialty?.name ?? 'Scholar'}
        title={scholar.name}
        intro={scholar.bio ?? `Published work by ${scholar.name}, gathered in one place.`}
        meta={
          <StatRow
            items={[
              { value: work.loading || work.error ? '—' : `${work.total}`, label: 'Items' },
              { value: work.loading || work.error ? '—' : `${series.length}`, label: 'Series in view' },
              { value: 'Free', label: 'Access' },
            ]}
          />
        }
      />
      {body}
    </>
  );
}
