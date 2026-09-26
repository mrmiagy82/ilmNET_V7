import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { Tag } from '../components/ui';
import { listPublishedContents, listPublicSubjects, getPublicSubject, type BackendContent, type BackendSubject } from '@/lib/api';
import { groupByCollection } from '@/lib/series';
import { resolveThumbnail } from '@/lib/thumbnail';
import { usePageMeta } from '../lib/usePageMeta';
// Discovery step D0: these two cards were a second copy of the library cards — same cards, tighter density.
import { CompactSeriesCard, CompactContentCard } from '@/components/cards';

export default function SubjectDetail() {
  const { id } = useParams<{ id: string }>();
  const decoded = id ? decodeURIComponent(id) : '';
  const [subject, setSubject] = useState<BackendSubject | null>(null);
  const [contents, setContents] = useState<BackendContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fase 5.5: title from the subject, image from the first item; noindex only after the load failed
  // or the subject turned out not to exist.
  usePageMeta({
    title: subject?.name,
    description: subject?.description ?? undefined,
    image: contents[0] ? resolveThumbnail(contents[0]).src : null,
    path: decoded ? `/subjects/${encodeURIComponent(decoded)}` : '',
    noindex: !loading && !subject,
  });

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
              <p className="text-ink-muted mt-1 text-[0.82rem]">Relevant series first — open a series to see all its episodes (e.g. Tahawiyyah → Lectures 1-4).</p>
              <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {seriesLectures.map((s) => <CompactSeriesCard key={s.id} s={s} />)}
              </div>
            </div>
          )}

          {seriesBooks.length > 0 && (
            <div>
              <h2 className="font-display text-ink text-[1.35rem] font-extrabold">Collections — {subject.name}</h2>
              <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {seriesBooks.map((s) => <CompactSeriesCard key={s.id} s={s} />)}
              </div>
            </div>
          )}

          {lectures.length > 0 && (
            <div>
              <h2 className="font-display text-ink text-[1.35rem] font-extrabold">Single lectures — {subject.name}</h2>
              <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {lectures.map((c) => <CompactContentCard key={c.id} c={c} />)}
              </div>
            </div>
          )}

          {books.length > 0 && (
            <div>
              <h2 className="font-display text-ink text-[1.35rem] font-extrabold">Single books — {subject.name}</h2>
              <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {books.map((c) => <CompactContentCard key={c.id} c={c} />)}
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
