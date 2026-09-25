import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { Tag } from '../components/ui';
import { listPublishedContents, type BackendContent } from '@/lib/api';
import { resolveThumbnail, resolveCover } from '@/lib/thumbnail';
import MediaThumb from '@/components/MediaThumb';
import { formatDuration } from '../data';
import { usePageMeta } from '../lib/usePageMeta';

function EpisodeRow({ c, idx }: { c: BackendContent; idx: number }) {
  const isBook = c.type === 'book' || c.type === 'document';
  const media = isBook ? resolveCover(c) : resolveThumbnail(c);
  const thumb = media.src;
  const isVideo = c.type === 'video' || c.type === 'lecture';
  return (
    <Link to={`/${c.type === 'book' || c.type === 'document' ? 'books' : 'lectures'}/${c.slug}`} className="bg-cream neu-raised group flex gap-4 rounded-[22px] p-4 transition-transform hover:-translate-y-1">
      <MediaThumb
        src={thumb}
        kind={media.kind}
        testId="episode-thumb"
        className="bg-sand neu-inset aspect-[16/10] w-32 shrink-0 rounded-[14px] sm:w-40"
        fallback={<div className="absolute inset-0 bg-gradient-to-br from-olive/10 to-rose/10" />}
      >
        <span className="bg-cream/90 text-ink absolute left-2 top-2 rounded-full px-2 py-1 text-[0.62rem] font-bold">{String(idx + 1).padStart(2, '0')}</span>
        <span className="bg-rose text-cream absolute bottom-2 right-2 rounded-full px-2 py-1 text-[0.62rem] font-semibold">{isVideo ? 'Video' : c.type === 'audio' ? 'Audio' : 'Book'}</span>
      </MediaThumb>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-ink line-clamp-2 text-[0.98rem] font-bold leading-tight">{c.title}</h3>
        <p className="text-rose mt-1 text-[0.78rem] font-semibold line-clamp-1">{c.scholars[0]?.scholar.name ?? ''}</p>
        <p className="text-ink-muted mt-1 line-clamp-2 text-[0.78rem]">{c.description?.slice(0, 90) ?? ''}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {c.subjects[0] && <Tag tone={c.subjects[0].subject.accent as any}>{c.subjects[0].subject.name}</Tag>}
          {c.durationMin && <span className="bg-sand text-ink-soft rounded-full px-2 py-1 text-[0.62rem] font-medium">{formatDuration(c.durationMin)}</span>}
          {c.language && <span className="bg-sand text-ink-soft rounded-full px-2 py-1 text-[0.62rem] font-medium">{c.language}</span>}
        </div>
      </div>
    </Link>
  );
}

export default function SeriesDetail() {
  const { id } = useParams<{ id: string }>();
  const decoded = id ? decodeURIComponent(id) : '';
  const [items, setItems] = useState<BackendContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fase 5.5: title/description from the collection itself (see ContentDetail for the noindex rule).
  const firstItem = items[0];
  const seriesTitle = firstItem?.collectionTitle || firstItem?.series || (decoded ? decoded.replace(/[-_]/g, ' ') : undefined);
  usePageMeta({
    title: seriesTitle,
    description: firstItem?.description ?? undefined,
    type: 'article',
    image: firstItem ? resolveThumbnail(firstItem).src : null,
    path: decoded ? `/series/${encodeURIComponent(decoded)}` : '',
    noindex: !loading && items.length === 0,
  });

  useEffect(() => {
    if (!decoded) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Fase 5.4: ask the API for exactly this collection (equality on the indexed
        // `collectionIdentifier`). The previous `q=<identifier>` was a free-text search over nine
        // columns: ~0,3–0,6 s per request on a 20 000-record library instead of ~0,01 s, and it also
        // matched collections that merely share a prefix.
        const res = await listPublishedContents({ limit: 100, collection: decoded });
        const filtered = (res.data as BackendContent[]).filter((c) => c.collectionIdentifier === decoded);
        // If still none, try to find by slug? Maybe collection is single? But we are series, so should have items
        if (!cancelled) {
          filtered.sort((a, b) => a.title.localeCompare(b.title));
          setItems(filtered);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load series');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [decoded]);

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Series" title="Loading…" intro="Fetching episodes." />
        <section className="px-5 pb-24 sm:px-6">
          <div className="mx-auto max-w-[860px]">
            <div className="bg-sand neu-inset rounded-[24px] h-40 animate-pulse" />
          </div>
        </section>
      </>
    );
  }

  if (error || items.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Series" title="Series not found" intro={error ?? 'No items found for this collection.'} />
        <section className="px-5 pb-24 sm:px-6">
          <div className="mx-auto max-w-[860px]">
            <div className="bg-cream neu-raised rounded-[24px] p-8 text-center">
              <p className="text-ink-soft">No episodes found for <span className="font-mono text-[0.8rem]">{decoded}</span></p>
              <div className="mt-6 flex justify-center gap-3">
                <Link to="/lectures" className="bg-rose text-cream rounded-full px-6 py-3 text-[0.9rem] font-semibold">Lectures</Link>
                <Link to="/books" className="bg-sand text-ink rounded-full px-6 py-3 text-[0.9rem] font-semibold">Books</Link>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  const first = items[0]!;
  const isBookSeries = first.type === 'book' || first.type === 'document';
  const typeLabel = first.provider === 'youtube' ? 'YouTube Playlist' : first.provider === 'archive' ? 'Archive.org Collection' : 'Series';
  const title = first.collectionTitle || first.series || decoded.replace(/[-_]/g, ' ');

  return (
    <>
      <PageHeader
        eyebrow={`${typeLabel} · ${items.length} ${isBookSeries ? 'books' : 'episodes'}`}
        title={title}
        intro={first.description?.slice(0, 180) ?? `This ${isBookSeries ? 'collection' : 'series'} contains ${items.length} items — open an episode to watch, listen or read.`}
        meta={
          <div className="flex flex-wrap gap-2">
            {first.subjects.map((s) => (
              <Tag key={s.subject.id} tone={s.subject.accent as any}>{s.subject.name}</Tag>
            ))}
            <span className="bg-sand text-ink-soft rounded-full px-3 py-1.5 text-[0.72rem] font-medium">{first.provider}</span>
            <span className="bg-cream neu-inset rounded-full px-3 py-1.5 text-[0.72rem] font-medium">{items.length} parts</span>
          </div>
        }
      />

      <section className="px-5 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-[860px] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-ink text-[1.2rem] font-extrabold">Episodes</h2>
            <Link to={isBookSeries ? '/books' : '/lectures'} className="text-rose text-[0.86rem] font-semibold">Back to {isBookSeries ? 'books' : 'lectures'} →</Link>
          </div>

          <div className="grid gap-4">
            {items.map((c, idx) => (
              <EpisodeRow key={c.id} c={c} idx={idx} />
            ))}
          </div>

          <div className="bg-cream neu-inset rounded-[22px] p-6 text-center">
            <p className="text-ink-muted text-[0.82rem]">All {items.length} {isBookSeries ? 'books' : 'episodes'} shown — share this collection via URL.</p>
            <p className="text-ink-soft font-mono text-[0.68rem] mt-2">collectionIdentifier: {decoded}</p>
          </div>
        </div>
      </section>
    </>
  );
}
