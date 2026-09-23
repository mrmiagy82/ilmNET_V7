import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { Tag } from '../components/ui';
import { listPublishedContents, listPublicSubjects, getPublicSubject, type BackendContent, type BackendSubject } from '@/lib/api';
import { groupByCollection, type SeriesGroup } from '@/lib/series';
import { resolveCardMedia } from '@/lib/thumbnail';
import MediaThumb from '@/components/MediaThumb';

function SeriesCard({ s }: { s: SeriesGroup }) {
  const media = s.items[0] ? resolveCardMedia(s.items[0]) : { src: null, kind: 'placeholder-generic' as const };
  const thumb = media.src;
  return (
    <Link to={`/series/${encodeURIComponent(s.id)}`} className="bg-cream neu-raised group flex flex-col rounded-[30px] p-6 transition-transform hover:-translate-y-1.5">
      <MediaThumb
        src={thumb}
        kind={media.kind}
        testId="subject-series-thumb"
        className="bg-sand neu-inset aspect-[16/10] rounded-[22px]"
        fallback={<div className="absolute inset-0 bg-gradient-to-br from-olive/15 to-rose/15" />}
      >
        <span className="bg-cream/90 text-ink absolute left-3 top-3 rounded-full px-3 py-1.5 text-[0.68rem] font-bold">Series · {s.count}</span>
        <span className="bg-cream neu-raised-sm absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-[12px] px-3 py-2 text-[0.76rem] font-semibold">
          <span>{s.count} parts</span><span className="text-rose">Open →</span>
        </span>
      </MediaThumb>
      <h3 className="font-display text-ink mt-4 line-clamp-2 text-[1.1rem] font-extrabold">{s.title}</h3>
      <p className="text-ink-muted mt-2 line-clamp-2 text-[0.82rem]">{s.description ?? `${s.count} items`}</p>
    </Link>
  );
}

function ContentCard({ c }: { c: BackendContent }) {
  const isBook = c.type === 'book' || c.type === 'document';
  const media = resolveCardMedia(c);
  const thumb = media.src;
  return (
    <Link to={`/${isBook ? 'books' : 'lectures'}/${c.slug}`} className="bg-cream neu-raised group flex flex-col rounded-[30px] p-6 hover:-translate-y-1.5 transition-transform">
      <MediaThumb
        src={thumb}
        kind={media.kind}
        testId="subject-content-thumb"
        className={`bg-sand neu-inset rounded-[22px] ${isBook ? 'aspect-[3/4]' : 'aspect-[16/10]'}`}
        fallback={<div className="absolute inset-0 bg-gradient-to-br from-sand to-cream" />}
      >
        <span className="bg-cream/90 absolute right-3 top-3 rounded-full px-2.5 py-1 text-[0.62rem] font-semibold">{isBook ? 'Book' : c.type === 'audio' ? 'Audio' : 'Video'}</span>
      </MediaThumb>
      <h3 className="font-display text-ink mt-4 line-clamp-2 text-[1.05rem] font-bold">{c.title}</h3>
      <p className="text-ink-muted mt-2 line-clamp-2 text-[0.82rem]">{c.description?.slice(0, 80) ?? ''}</p>
    </Link>
  );
}

export default function SubjectDetail() {
  const { id } = useParams<{ id: string }>();
  const decoded = id ? decodeURIComponent(id) : '';
  const [subject, setSubject] = useState<BackendSubject | null>(null);
  const [contents, setContents] = useState<BackendContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!decoded) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Try to fetch subject by slug/id
        let subj: BackendSubject | null = null;
        try {
          const res = await getPublicSubject(decoded);
          subj = (res as any).data;
        } catch {
          // Fallback: list and find
          const all = await listPublicSubjects();
          subj = all.data.find((s) => s.slug === decoded || s.id === decoded || s.name.toLowerCase() === decoded.toLowerCase()) ?? null;
        }
        if (!cancelled) setSubject(subj);

        // Fetch contents for this subject
        const contRes = await listPublishedContents({ limit: 100, subject: decoded });
        let data = contRes.data as BackendContent[];
        if (data.length === 0 && subj) {
          // Try by id
          const alt = await listPublishedContents({ limit: 100, subject: subj.id });
          data = alt.data as BackendContent[];
        }
        if (!cancelled) setContents(data);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [decoded]);

  const { series, standalone } = useMemo(() => groupByCollection(contents), [contents]);
  const lectures = useMemo(() => standalone.filter((c) => ['lecture', 'video', 'audio'].includes(c.type)), [standalone]);
  const books = useMemo(() => standalone.filter((c) => ['book', 'document'].includes(c.type)), [standalone]);
  const seriesLectures = useMemo(() => series.filter((s) => s.items[0] && ['lecture', 'video', 'audio'].includes(s.items[0].type)), [series]);
  const seriesBooks = useMemo(() => series.filter((s) => s.items[0] && ['book', 'document'].includes(s.items[0].type)), [series]);

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="Subject" title="Loading…" intro="Fetching subject." />
        <section className="px-5 pb-24 sm:px-6"><div className="mx-auto max-w-[1180px]"><div className="bg-sand neu-inset h-40 rounded-[24px] animate-pulse" /></div></section>
      </>
    );
  }

  if (!subject) {
    return (
      <>
        <PageHeader eyebrow="Subject" title="Not found" intro={error ?? 'Subject not found.'} />
        <section className="px-5 pb-24 sm:px-6"><div className="mx-auto max-w-[1180px]"><Link to="/subjects" className="bg-rose text-cream rounded-full px-6 py-3 font-semibold">Back to subjects</Link></div></section>
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
            <Tag tone={subject.accent as any}>{subject.group}</Tag>
            <span className="bg-sand text-ink-soft rounded-full px-3 py-1.5 text-[0.72rem] font-medium">{contents.length} items</span>
            <span className="bg-cream neu-inset rounded-full px-3 py-1.5 text-[0.72rem] font-medium">{series.length} series</span>
          </div>
        }
      />

      <section className="px-5 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-[1180px] space-y-10">

          {seriesLectures.length > 0 && (
            <div>
              <h2 className="font-display text-ink text-[1.35rem] font-extrabold">Series — {subject.name}</h2>
              <p className="text-ink-muted mt-1 text-[0.82rem]">Relevante series eerst — open een serie om alle afleveringen te zien (bv. Tahawiyyah → Lezing 1-4).</p>
              <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {seriesLectures.map((s) => <SeriesCard key={s.id} s={s} />)}
              </div>
            </div>
          )}

          {seriesBooks.length > 0 && (
            <div>
              <h2 className="font-display text-ink text-[1.35rem] font-extrabold">Collections — {subject.name}</h2>
              <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {seriesBooks.map((s) => <SeriesCard key={s.id} s={s} />)}
              </div>
            </div>
          )}

          {lectures.length > 0 && (
            <div>
              <h2 className="font-display text-ink text-[1.35rem] font-extrabold">Single lectures — {subject.name}</h2>
              <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {lectures.map((c) => <ContentCard key={c.id} c={c} />)}
              </div>
            </div>
          )}

          {books.length > 0 && (
            <div>
              <h2 className="font-display text-ink text-[1.35rem] font-extrabold">Single books — {subject.name}</h2>
              <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {books.map((c) => <ContentCard key={c.id} c={c} />)}
              </div>
            </div>
          )}

          {contents.length === 0 && (
            <div className="bg-cream neu-inset rounded-[24px] p-8 text-center">
              <p className="text-ink-muted">No published content yet for this subject.</p>
              <Link to="/lectures" className="text-rose mt-3 inline-block font-semibold">Browse lectures →</Link>
            </div>
          )}

          <div className="flex gap-3">
            <Link to="/subjects" className="bg-sand text-ink rounded-full px-6 py-3 text-[0.9rem] font-semibold">Back to subjects</Link>
            <Link to={`/lectures?subject=${subject.slug}`} className="bg-cream neu-raised-sm text-ink rounded-full px-6 py-3 text-[0.9rem] font-semibold">View filtered lectures →</Link>
          </div>
        </div>
      </section>
    </>
  );
}
