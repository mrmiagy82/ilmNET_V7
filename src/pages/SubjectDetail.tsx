/**
 * `/subjects/:id` — one subject as a discovery page (Discovery step D3).
 *
 * The page keeps its structure (series first, then single lectures, then single books — the order the
 * audit called out as the right one for a subject) and adds what the plan asked for: a "newest" rail, the
 * series rail and a "by scholar" rail, all built from the same paging hook the library pages use.
 *
 * What changed under the hood:
 *   - the identity comes from `GET /api/subjects/:id` only. The old code tried the detail endpoint, then
 *     fetched *every* subject and matched on slug/id/name in the browser, and finally re-queried the
 *     contents by slug and again by id when the first answer was empty (audit A7/D10) — up to four round
 *     trips to render one page. `subject=` already accepts a slug, an id or a name, so one query is enough;
 *   - the counters are real: `pagination.total` for the items, and the series count of the loaded set is
 *     labelled as exactly that ("in view") instead of being passed off as the whole library.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { SectionHeading } from '../components/Rail';
import { usePageMeta } from '../lib/usePageMeta';
import { EmptyState, MetaChip, ResultCount } from '../components/ui';
import {
  BookCard,
  CollectionCard,
  LectureCard,
  ScholarMiniCard,
  SeriesCard,
  TileSkeleton,
  type MiniScholar,
} from '@/components/cards';
import { Rail, RAIL_SLOT } from '@/components/Rail';
import { CardGridSkeleton, ListErrorCard, LoadMore } from '@/components/ListStates';
import { usePagedContentQuery, LIBRARY_PAGE_SIZE } from '@/lib/usePagedContentQuery';
import { groupByCollection } from '@/lib/series';
import { getPublicSubject, type BackendContent, type BackendSubject } from '@/lib/api';

/** The newest strip on the page shows this many items, and only when the subject is bigger than a page. */
const NEWEST_RAIL = 12;

const isBookish = (c: BackendContent) => c.type === 'book' || c.type === 'document';

export default function SubjectDetail() {
  const { id } = useParams<{ id: string }>();
  const decoded = id ? decodeURIComponent(id) : '';

  const [subject, setSubject] = useState<BackendSubject | null>(null);
  const [identityState, setIdentityState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!decoded) return;
    let alive = true;
    setIdentityState('loading');
    getPublicSubject(decoded)
      .then((res) => {
        if (!alive) return;
        setSubject(res.data);
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

  const contents = usePagedContentQuery({ subject: decoded }, { shelf: 'library', errorMessage: 'Failed to load this subject' });
  const newest = usePagedContentQuery(
    { subject: decoded },
    { shelf: 'library', pageSize: NEWEST_RAIL, sort: 'publishedAt:desc', enabled: contents.total > LIBRARY_PAGE_SIZE },
  );

  // Fase 5.5: title from the subject, image from the first item; noindex while it does not exist.
  usePageMeta({
    title: subject?.name ?? 'Subject',
    description: subject?.description ?? undefined,
    image: contents.data[0] ? (contents.data[0].thumbnailUrl ?? null) : null,
    path: decoded ? `/subjects/${encodeURIComponent(decoded)}` : '',
    noindex: identityState === 'missing' || identityState === 'error',
  });

  const { series, standalone } = useMemo(() => groupByCollection(contents.data), [contents.data]);
  const lectures = useMemo(() => standalone.filter((c) => !isBookish(c)), [standalone]);
  const books = useMemo(() => standalone.filter(isBookish), [standalone]);
  const seriesLectures = useMemo(() => series.filter((s) => s.items[0] && !isBookish(s.items[0])), [series]);
  const seriesBooks = useMemo(() => series.filter((s) => s.items[0] && isBookish(s.items[0])), [series]);

  // The scholars who really appear in the items loaded in this view — no separate request, no guess.
  const scholarsInView = useMemo(() => {
    const seen = new Map<string, MiniScholar>();
    for (const c of contents.data) {
      for (const link of c.scholars ?? []) {
        const s = link.scholar;
        if (s?.slug && !seen.has(s.slug)) seen.set(s.slug, s as MiniScholar);
      }
    }
    return [...seen.values()];
  }, [contents.data]);

  const showNewestRail = newest.total > LIBRARY_PAGE_SIZE && newest.data.length > 0;

  if (identityState === 'loading') {
    return (
      <>
        <PageHeader eyebrow="Subject" title="Loading…" intro="Fetching this subject." />
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

  if (identityState !== 'ready' || !subject) {
    return (
      <>
        <PageHeader
          eyebrow="Subject"
          title={identityState === 'error' ? 'Could not load this subject' : 'Not found'}
          intro={
            identityState === 'error'
              ? 'The library could not be reached just now. This is usually temporary.'
              : 'This subject does not exist (any more) in the published library.'
          }
        />
        <section className="px-5 pb-24 sm:px-6">
          <div className="mx-auto max-w-[1180px]">
            <div className="bg-cream neu-raised rounded-[24px] p-8 text-center">
              <p className="text-ink-muted text-[0.9rem]">Every subject gathers the lectures, series and books that belong to it.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {identityState === 'error' && (
                  <button onClick={() => setNonce((n) => n + 1)} className="bg-rose text-cream rounded-full px-6 py-3 text-[0.9rem] font-semibold">
                    Try again
                  </button>
                )}
                <Link to="/subjects" className="bg-cream neu-raised-sm text-ink rounded-full px-6 py-3 text-[0.9rem] font-semibold">
                  All subjects
                </Link>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={subject.group}
        title={subject.name}
        intro={subject.description ?? `All lectures and books for ${subject.name}.`}
        meta={
          <div className="flex flex-wrap gap-2">
            <MetaChip variant="strong">{subject.group}</MetaChip>
            <MetaChip variant="inset">
              {contents.loading || contents.error ? '—' : `${contents.total} items`}
            </MetaChip>
            <MetaChip>{contents.loading || contents.error ? '—' : `${series.length} series in view`}</MetaChip>
          </div>
        }
      />

      <section className="px-5 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-[1180px]">
          {contents.loading ? (
            <>
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium">Loading {subject.name}…</p>
              <CardGridSkeleton count={6} />
            </>
          ) : contents.error && contents.data.length === 0 ? (
            <ListErrorCard title={`Could not load ${subject.name}`} onRetry={contents.retry} retrying={contents.loading} />
          ) : (
            <>
              <div className="mt-8">
                <ResultCount>
                  {contents.total} {contents.total === 1 ? 'item' : 'items'} in {subject.name}
                  {contents.hasMore ? ` · showing ${contents.data.length} of ${contents.total}` : ''}
                </ResultCount>
              </div>

              {showNewestRail && (
                <Rail
                  className="mt-10"
                  bleed={false}
                  label="Recently added"
                  title="Newest first"
                  subtitle={`The latest items in ${subject.name}`}
                  items={newest.data.length}
                  loading={newest.loading}
                  skeletonCount={4}
                  itemClassName={RAIL_SLOT.media}
                >
                  {newest.data.map((c) => (isBookish(c) ? <BookCard key={c.id} c={c} /> : <LectureCard key={c.id} c={c} />))}
                </Rail>
              )}

              {scholarsInView.length > 1 && (
                <Rail
                  className="mt-12"
                  bleed={false}
                  title="By scholar"
                  subtitle={`The scholars in the ${contents.data.length} items loaded in this view — open one to see their whole body of work`}
                  items={scholarsInView.length}
                  itemClassName={RAIL_SLOT.scholar}
                >
                  {scholarsInView.map((s) => (
                    <ScholarMiniCard key={s.slug} scholar={s} />
                  ))}
                </Rail>
              )}

              {seriesLectures.length > 0 && (
                <div className="mt-14">
                  <SectionHeading
                    label="Series"
                    title={`Series — ${subject.name}`}
                    subtitle="Relevant series first — open a series to see all its episodes."
                  />
                  <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {seriesLectures.map((s) => (
                      <SeriesCard key={s.id} s={s} />
                    ))}
                  </div>
                </div>
              )}

              {seriesBooks.length > 0 && (
                <div className="mt-14">
                  <SectionHeading label="Books" title={`Collections — ${subject.name}`} />
                  <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {seriesBooks.map((s) => (
                      <CollectionCard key={s.id} s={s} />
                    ))}
                  </div>
                </div>
              )}

              {lectures.length > 0 && (
                <div className="mt-14">
                  <SectionHeading label="Listen" title={`Single lectures — ${subject.name}`} />
                  <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {lectures.map((c) => (
                      <LectureCard key={c.id} c={c} />
                    ))}
                  </div>
                </div>
              )}

              {books.length > 0 && (
                <div className="mt-14">
                  <SectionHeading label="Read" title={`Single books — ${subject.name}`} />
                  <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {books.map((c) => (
                      <BookCard key={c.id} c={c} />
                    ))}
                  </div>
                </div>
              )}

              {contents.error && contents.data.length > 0 && (
                <p className="text-rose mt-8 text-center text-[0.86rem] font-medium" role="status">
                  Could not load more —{' '}
                  <button type="button" onClick={contents.retry} className="underline">
                    try again
                  </button>
                </p>
              )}

              {contents.hasMore && !contents.error && (
                <LoadMore shown={contents.data.length} total={contents.total} noun="item" loading={contents.loadingMore} onClick={contents.loadMore} />
              )}

              {contents.data.length === 0 && (
                <div className="mt-10">
                  <EmptyState
                    title={`Nothing published for ${subject.name} yet`}
                    body="This subject exists, but no published content is linked to it yet. Everything published under it will appear here."
                  />
                </div>
              )}
            </>
          )}

          <div className="border-line/70 mt-16 flex flex-wrap items-center gap-3 border-t pt-10">
            <Link
              to={`/lectures?subject=${encodeURIComponent(subject.slug)}`}
              className="bg-rose text-cream lift-sm inline-flex items-center gap-2 rounded-full px-6 py-3 text-[0.9rem] font-semibold shadow-[10px_14px_30px_rgba(204,58,99,0.24)]"
            >
              {subject.name} in the lecture shelf <span aria-hidden="true">→</span>
            </Link>
            <Link
              to={`/books?subject=${encodeURIComponent(subject.slug)}`}
              className="bg-cream neu-raised-sm text-ink lift-sm inline-flex items-center gap-2 rounded-full px-6 py-3 text-[0.9rem] font-semibold"
            >
              {subject.name} in the book shelf <span aria-hidden="true">→</span>
            </Link>
            <Link
              to="/subjects"
              className="text-ink-soft hover:text-rose inline-flex items-center gap-2 rounded-full px-4 py-3 text-[0.9rem] font-semibold transition-colors"
            >
              All subjects
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
