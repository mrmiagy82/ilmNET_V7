import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { usePageMeta } from '../lib/usePageMeta';
import { FilterChips, EmptyState, StatRow } from '../components/ui';
import { listPublicSubjects, listPublishedContents, type BackendSubject, type BackendContent } from '@/lib/api';
import { subjectGroups, formatCount } from '../data';

function SubjectTile({ s, lectureCount, bookCount }: { s: BackendSubject; lectureCount: number; bookCount: number }) {
  const badge = s.accent === 'rose' ? 'bg-rose text-cream' : s.accent === 'olive' ? 'bg-olive text-[#22251a]' : 'bg-sand text-ink-soft';
  return (
    <article className="bg-cream neu-raised group flex flex-col rounded-[32px] p-7 transition-transform duration-500 hover:-translate-y-1.5">
      <div className="flex items-start justify-between gap-4">
        <div className={`font-display grid h-14 w-14 shrink-0 place-items-center rounded-[18px] text-[1.25rem] font-extrabold neu-raised-sm ${badge}`}>
          {s.name.charAt(0)}
        </div>
        <span className="text-ink-muted text-[0.7rem] font-semibold uppercase tracking-[0.16em]">{s.group}</span>
      </div>

      <h3 className="font-display text-ink mt-5 text-[1.4rem] leading-tight font-extrabold tracking-[-0.03em]">
        {s.name}
      </h3>
      <p className="text-ink-soft mt-3 flex-1 text-[0.92rem] leading-relaxed line-clamp-3">{s.description ?? ''}</p>

      <div className="border-line/70 mt-6 flex items-center justify-between border-t pt-5">
        <div className="flex gap-6">
          <div>
            <p className="font-display text-ink text-[1.2rem] font-extrabold leading-none">{lectureCount}</p>
            <p className="text-ink-muted mt-1.5 text-[0.72rem] font-medium uppercase tracking-[0.08em]">Lectures</p>
          </div>
          <div>
            <p className="font-display text-ink text-[1.2rem] font-extrabold leading-none">{bookCount}</p>
            <p className="text-ink-muted mt-1.5 text-[0.72rem] font-medium uppercase tracking-[0.08em]">Books</p>
          </div>
        </div>
        <Link to={`/subjects/${s.slug}`} className="text-rose inline-flex items-center gap-1.5 text-[0.86rem] font-semibold transition-all group-hover:gap-2.5">
          Explore <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}

function SkeletonTile() {
  return (
    <article className="bg-cream neu-raised flex flex-col rounded-[32px] p-7 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="bg-sand neu-raised-sm h-14 w-14 rounded-[18px]" />
        <div className="bg-sand h-3 w-16 rounded-full" />
      </div>
      <div className="bg-sand mt-5 h-6 w-3/4 rounded-full" />
      <div className="bg-sand mt-3 h-16 rounded-[12px]" />
      <div className="bg-sand mt-6 h-10 rounded-full" />
    </article>
  );
}

export default function Subjects() {
  usePageMeta({
    title: 'Subjects',
    description:
      'Browse the ilmNet library by subject — every lecture, book and series that belongs to a discipline, grouped the way the tradition already is.',
    path: '/subjects',
  });

  const [group, setGroup] = useState<string | 'all'>('all');
  const [subjects, setSubjects] = useState<BackendSubject[]>([]);
  const [contents, setContents] = useState<BackendContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [subjRes, contRes] = await Promise.all([
        listPublicSubjects(),
        listPublishedContents({ limit: 100 }).catch(() => ({ data: [] as BackendContent[], pagination: { total: 0, page: 1, limit: 100, totalPages: 1 } } as any)),
      ]);
      setSubjects(subjRes.data);
      setContents((contRes as any).data ?? []);
    } catch (e: any) {
      setError(e.message || 'Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const countsBySubject = useMemo(() => {
    const map = new Map<string, { lecture: number; book: number }>();
    for (const s of subjects) map.set(s.id, { lecture: 0, book: 0 });
    for (const c of contents) {
      const isLecture = c.type === 'lecture' || c.type === 'video' || c.type === 'audio';
      const isBook = c.type === 'book' || c.type === 'document';
      for (const cs of c.subjects) {
        const cur = map.get(cs.subjectId);
        if (!cur) continue;
        if (isLecture) cur.lecture += 1;
        if (isBook) cur.book += 1;
      }
    }
    return map;
  }, [subjects, contents]);

  const filtered = useMemo(() => (group === 'all' ? subjects : subjects.filter((s) => s.group === group)), [subjects, group]);

  const totalLectures = useMemo(() => subjects.reduce((a, s) => a + (countsBySubject.get(s.id)?.lecture ?? 0), 0), [subjects, countsBySubject]);
  const totalBooks = useMemo(() => subjects.reduce((a, s) => a + (countsBySubject.get(s.id)?.book ?? 0), 0), [subjects, countsBySubject]);

  return (
    <>
      <PageHeader
        eyebrow="Browse by subject"
        title="Subjects"
        intro="Start from what you want to understand. Choose a discipline and ilmNet gathers every lecture, book and series that belongs to it — grouped the way the tradition already is."
        meta={<StatRow items={[{ value: loading || error ? '—' : `${subjects.length}`, label: 'Subjects' }, { value: loading || error ? '—' : formatCount(totalLectures), label: 'Lectures' }, { value: loading || error ? '—' : `${totalBooks}`, label: 'Books' }]} />}
      />

      <section className="px-5 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-[1180px]">
          <div className="bg-sand/70 neu-inset sticky top-[88px] z-30 rounded-[34px] p-4 sm:p-6">
            <FilterChips options={subjectGroups.map((g) => ({ value: g, label: g }))} active={group} onChange={setGroup} allLabel="All groups" />
          </div>

          {loading ? (
            <>
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium">Loading subjects…</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonTile key={i} />)}
              </div>
            </>
          ) : error ? (
            <div className="mt-10 bg-cream neu-raised rounded-[24px] p-8 text-center">
              <p className="font-display text-ink text-[1.1rem] font-bold">Could not load subjects</p>
              <p className="text-ink-soft mt-2 text-[0.9rem]">{error}</p>
              <button onClick={fetchData} className="bg-rose text-cream mt-6 rounded-full px-6 py-3 text-[0.9rem] font-semibold">Try again</button>
            </div>
          ) : (
            <>
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium">
                {filtered.length} subjects shown
              </p>
              {filtered.length ? (
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((s) => {
                    const c = countsBySubject.get(s.id) ?? { lecture: 0, book: 0 };
                    return <SubjectTile key={s.id} s={s} lectureCount={c.lecture} bookCount={c.book} />;
                  })}
                </div>
              ) : subjects.length === 0 ? (
                <div className="mt-10">
                  <EmptyState title="No subjects yet" body="Subjects will appear here once created." />
                </div>
              ) : (
                <div className="mt-10">
                  <EmptyState title="Nothing here yet" body="Select a group to see its subjects." />
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
