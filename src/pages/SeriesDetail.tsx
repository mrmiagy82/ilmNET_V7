/**
 * A collection page — `/series/:id` (Fase 3.5; corrected in D6).
 *
 * What this page was, and what changed in D6:
 *
 *   - **It read `limit: 100` and then claimed completeness.** "All N items shown" was printed over a
 *     single capped request, so on a collection of 150 records it said "All 100 …" (audit C2/A5). The
 *     page now uses the same accumulating paging as the library shelves (`usePagedContentQuery`, 24 per
 *     page, "Load more") and every number on it comes from `pagination.total`.
 *   - **It numbered the episodes alphabetically.** A positional badge (01, 02, 03 …) was drawn over a
 *     list sorted by title, which presents an A–Z result as a sequence a visitor should follow (audit
 *     A3). There is no episode number, position or import order anywhere in the data, so the badge is
 *     gone and the page says what the order actually is: the library's own order.
 *   - **It printed an internal identifier.** A public page showed `collectionIdentifier: <raw id>` in a
 *     monospace box (audit C2). The URL is still the identifier — that is how a collection is addressed —
 *     but the box is gone.
 *
 * What deliberately did **not** change: no next/previous, no "Episode 3 of 12", no "start from the
 * beginning" — all of those need a real position stored at import time (plan item B5, a schema and
 * importer change). D6 must not fake a sequence, so the page offers the two things that are true: the
 * whole collection with real paging, and a link to each item.
 */
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { MetaChip, Tag } from '../components/ui';
import type { BackendContent } from '@/lib/api';
import { usePagedContentQuery } from '@/lib/usePagedContentQuery';
import { resolveThumbnail, resolveCover } from '@/lib/thumbnail';
import MediaThumb from '@/components/MediaThumb';
import { CardGridSkeleton, ListErrorCard, LoadMore } from '@/components/ListStates';
import { formatDuration } from '../data';
import { usePageMeta } from '../lib/usePageMeta';

/** One row of the collection. The badge states the *kind* of the row, never a position in it. */
function EpisodeRow({ c }: { c: BackendContent }) {
  const isBook = c.type === 'book' || c.type === 'document';
  const media = isBook ? resolveCover(c) : resolveThumbnail(c);
  const thumb = media.src;
  const isVideo = c.type === 'video' || c.type === 'lecture';
  return (
    <Link to={`/${isBook ? 'books' : 'lectures'}/${c.slug}`} className="bg-cream neu-raised lift group flex gap-4 rounded-[24px] p-4">
      <MediaThumb
        src={thumb}
        kind={media.kind}
        testId="episode-thumb"
        className="bg-sand neu-inset aspect-[16/10] w-32 shrink-0 rounded-[16px] sm:w-40 lg:w-44"
        fallback={<div className="absolute inset-0 bg-gradient-to-br from-olive/10 to-rose/10" />}
      >
        <span className="bg-rose text-cream absolute bottom-2 right-2 rounded-full px-2 py-1 text-[0.68rem] font-semibold">{isVideo ? 'Video' : c.type === 'audio' ? 'Audio' : 'Book'}</span>
      </MediaThumb>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-ink line-clamp-2 text-[0.98rem] font-bold leading-tight">{c.title}</h3>
        <p className="text-rose mt-1 text-[0.78rem] font-semibold line-clamp-1">{c.scholars[0]?.scholar.name ?? ''}</p>
        <p className="text-ink-muted mt-1 line-clamp-2 text-[0.78rem]">{c.description?.slice(0, 90) ?? ''}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {c.subjects[0] && <Tag tone={c.subjects[0].subject.accent as any}>{c.subjects[0].subject.name}</Tag>}
          {c.durationMin && <span className="bg-sand text-ink-soft rounded-full px-2 py-1 text-[0.68rem] font-medium">{formatDuration(c.durationMin)}</span>}
          {c.language && <span className="bg-sand text-ink-soft rounded-full px-2 py-1 text-[0.68rem] font-medium">{c.language}</span>}
        </div>
      </div>
    </Link>
  );
}

export default function SeriesDetail() {
  const { id } = useParams<{ id: string }>();
  const decoded = id ? decodeURIComponent(id) : '';

  // Fase 5.4: equality on the indexed `collectionIdentifier` — never a free-text `q=` (AGENTS.md §2).
  // D6: with real paging, so the page can show every item of the collection, not the first hundred.
  const collection = usePagedContentQuery(
    { collection: decoded },
    { shelf: 'library', errorMessage: 'Failed to load this series' },
  );

  const items = collection.data;
  const total = collection.total;
  const first = items[0];
  const isBookSeries = first ? first.type === 'book' || first.type === 'document' : false;
  const noun = isBookSeries ? 'book' : 'episode';
  const typeLabel = first?.provider === 'youtube' ? 'YouTube Playlist' : first?.provider === 'archive' ? 'Archive.org Collection' : 'Series';
  const heading = isBookSeries ? 'Books' : 'Episodes';
  const seriesTitle = first?.collectionTitle || first?.series || (decoded ? decoded.replace(/[-_]/g, ' ') : undefined);

  // The facts panel is built from the loaded records only: the provider of the items, the subjects they
  // actually carry and the scholars who really appear in them. Nothing here is a new claim.
  const providerLabel =
    first?.provider === 'youtube' ? 'YouTube' : first?.provider === 'archive' ? 'Archive.org' : first?.provider ?? '';
  const subjectNames = (() => {
    const seen = new Map<string, { id: string; name: string; accent: string | null | undefined }>();
    for (const c of items) for (const s of c.subjects) if (!seen.has(s.subject.id)) seen.set(s.subject.id, s.subject);
    return Array.from(seen.values());
  })();
  const scholarNames = (() => {
    const seen = new Map<string, string>();
    for (const c of items) for (const s of c.scholars) if (!seen.has(s.scholar.id)) seen.set(s.scholar.id, s.scholar.name);
    return Array.from(seen.values());
  })();
  /** Accent values arrive as free strings; the Tag component only knows three tones. */
  const toneOf = (accent: string | null | undefined): 'rose' | 'olive' | 'plain' =>
    accent === 'rose' || accent === 'olive' ? accent : 'plain';

  // Fase 5.5: title/description from the collection itself (see ContentDetail for the noindex rule).
  usePageMeta({
    title: seriesTitle,
    description: first?.description ?? undefined,
    type: 'article',
    image: first ? resolveThumbnail(first).src : null,
    path: decoded ? `/series/${encodeURIComponent(decoded)}` : '',
    noindex: !collection.loading && total === 0,
  });

  if (collection.loading) {
    return (
      <>
        <PageHeader eyebrow="Series" title="Loading…" intro="Fetching the items of this collection." />
        <section className="px-5 pb-24 sm:px-6">
          <div className="mx-auto max-w-[860px]">
            <div className="bg-sand neu-inset rounded-[24px] h-40 animate-pulse" />
          </div>
        </section>
      </>
    );
  }

  // A failed first load (nothing on screen to keep), or a collection that really holds nothing
  // published. Two honest dead ends, each with a way back. A failure while *loading more* keeps the
  // items already shown and is handled inline below — that is the same split the library shelves use.
  const firstLoadFailed = Boolean(collection.error) && items.length === 0;
  if (firstLoadFailed || total === 0) {
    return (
      <>
        <PageHeader
          eyebrow="Series"
          title={firstLoadFailed ? 'Could not load this series' : 'Series not found'}
          intro={firstLoadFailed ? 'The library could not be reached just now.' : 'No published items belong to this collection.'}
        />
        <section className="px-5 pb-24 sm:px-6">
          <div className="mx-auto max-w-[860px]">
            {firstLoadFailed ? (
              <ListErrorCard title="We could not load this collection" onRetry={collection.retry} />
            ) : (
              <div className="bg-cream neu-raised rounded-[26px] p-8 text-center">
                <p className="text-ink-soft">Nothing published belongs to this collection.</p>
                <div className="mt-6 flex justify-center gap-3">
                  <Link to="/lectures" className="bg-rose text-cream lift-sm rounded-full px-6 py-3 text-[0.9rem] font-semibold shadow-[10px_14px_30px_rgba(204,58,99,0.24)] hover:bg-rose-deep">Lectures</Link>
                  <Link to="/books" className="bg-cream text-ink neu-raised-sm lift-sm rounded-full px-6 py-3 text-[0.9rem] font-semibold">Books</Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={`${typeLabel} · ${total} ${isBookSeries ? 'books' : 'episodes'}`}
        title={seriesTitle ?? 'Series'}
        intro={
          first?.description?.slice(0, 180) ??
          `This ${isBookSeries ? 'collection' : 'series'} contains ${total} ${isBookSeries ? 'books' : 'episodes'} — open an item to watch, listen or read.`
        }
        meta={
          <div className="flex flex-wrap gap-2">
            <MetaChip variant="strong">{typeLabel}</MetaChip>
            {first?.subjects.slice(0, 3).map((s) => (
              <MetaChip key={s.subject.id}>{s.subject.name}</MetaChip>
            ))}
            <MetaChip variant="inset">
              {total} {total === 1 ? noun : `${noun}s`}
            </MetaChip>
          </div>
        }
      />

      {/*
        Visual UI Polish: the collection now has two columns on a large screen instead of one narrow
        strip in a wide field. The left column is the real thing — the items, in the library's own order;
        the right column states the facts about the collection (provider, size, subjects, who appears in
        it) and repeats the honesty note as a footnote. Every number still comes from `pagination.total`
        or from the loaded records themselves; the panel adds no claim the data does not make.
      */}
      <section className="px-5 pb-20 sm:px-6 lg:pb-28">
        <div className="mx-auto grid max-w-[1180px] gap-10 lg:grid-cols-[1.62fr_0.38fr] lg:gap-12">
          <div className="min-w-0">
            <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
              <div>
                <h2 className="font-display text-ink text-[1.45rem] font-extrabold tracking-[-0.03em] sm:text-[1.62rem]">
                  {heading}
                </h2>
                {/*
                  The order is the library's own (newest change first) and there is no episode numbering in
                  the data — saying so once, in plain words, is what keeps this page from implying a
                  sequence that does not exist (audit A3, owner rule: never invent an order).
                */}
                <p className="text-ink-muted mt-2.5 text-[0.85rem]" role="status" aria-live="polite">
                  Showing {items.length} of {total} {total === 1 ? noun : `${noun}s`} — listed in the library’s own order
                  (most recently updated first). The source of this collection carries no episode numbering.
                </p>
              </div>
              <Link
                to={isBookSeries ? '/books' : '/lectures'}
                className="text-rose shrink-0 text-[0.88rem] font-semibold transition-all hover:gap-2.5 inline-flex items-center gap-1.5"
              >
                Back to {isBookSeries ? 'books' : 'lectures'} <span aria-hidden="true">→</span>
              </Link>
            </div>

            <div className="mt-6">
              {items.length === 0 ? (
                <CardGridSkeleton count={3} media={isBookSeries ? 'book' : 'video'} />
              ) : (
                <>
                  <div className="grid gap-4">
                    {items.map((c) => (
                      <EpisodeRow key={c.id} c={c} />
                    ))}
                  </div>

                  {collection.loadingMore && <p className="text-ink-muted mt-6 text-center text-[0.84rem]">Loading more…</p>}

                  {/* A failure while loading extra pages keeps what is on screen and says so — the list is not thrown away. */}
                  {collection.error && (
                    <div className="bg-cream neu-raised mt-6 rounded-[22px] p-6 text-center">
                      <p className="text-ink-soft text-[0.88rem]">The rest of this collection could not be loaded.</p>
                      <button
                        type="button"
                        onClick={collection.retry}
                        className="bg-rose text-cream lift-sm mt-4 rounded-full px-6 py-3 text-[0.9rem] font-semibold hover:bg-rose-deep"
                      >
                        Try again
                      </button>
                    </div>
                  )}

                  {collection.hasMore && !collection.error && (
                    <LoadMore
                      shown={items.length}
                      total={total}
                      noun={noun}
                      loading={collection.loadingMore}
                      onClick={collection.loadMore}
                    />
                  )}

                  {!collection.hasMore && (
                    <div className="bg-cream neu-inset mt-8 rounded-[22px] px-6 py-5 text-center">
                      <p className="text-ink-muted text-[0.82rem] leading-relaxed">
                        That is the whole collection — {total} {total === 1 ? noun : `${noun}s`}, all published items included.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <aside className="lg:pt-2">
            <div className="bg-sand/70 neu-inset rounded-[30px] p-6 lg:sticky lg:top-28">
              <p className="text-ink-muted text-[0.7rem] font-semibold tracking-[0.18em] uppercase">About this collection</p>

              <dl className="mt-5 space-y-3.5 text-[0.86rem]">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-muted">Type</dt>
                  <dd className="text-ink font-semibold">{typeLabel}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-muted">In this collection</dt>
                  <dd className="text-ink font-semibold">
                    {total} {total === 1 ? noun : `${noun}s`}
                  </dd>
                </div>
                {providerLabel && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-ink-muted">Source</dt>
                    <dd className="text-ink font-semibold">{providerLabel}</dd>
                  </div>
                )}
                {scholarNames.length > 0 && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-ink-muted">In this view</dt>
                    <dd className="text-ink text-right font-semibold">
                      {scholarNames.length} {scholarNames.length === 1 ? 'scholar' : 'scholars'}
                    </dd>
                  </div>
                )}
              </dl>

              {subjectNames.length > 0 && (
                <div className="border-line/70 mt-5 border-t pt-5">
                  <p className="text-ink-muted text-[0.7rem] font-semibold tracking-[0.18em] uppercase">Subjects</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {subjectNames.map((s) => (
                      <Tag key={s.id} tone={toneOf(s.accent)}>
                        {s.name}
                      </Tag>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-line/70 text-ink-muted mt-5 border-t pt-5 text-[0.78rem] leading-relaxed">
                Listed in the library’s own order. The source carries no episode numbering, so this page
                does not invent one.
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
