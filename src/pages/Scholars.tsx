import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { SearchBar, FilterChips, Tag, EmptyState, StatRow } from '../components/ui';
import { listPublicScholars, listPublicSubjects, listPublishedContents, type BackendScholar, type BackendSubject, type BackendContent } from '@/lib/api';

function ScholarTile({ s, lectureCount, bookCount }: { s: BackendScholar; lectureCount: number; bookCount: number }) {
  const specialtyName = (s as any).specialty?.name ?? '';
  const accent = (s as any).accent ?? s.accent ?? 'olive';
  return (
    <article className="bg-cream neu-raised group flex flex-col rounded-[30px] p-7 transition-transform duration-500 hover:-translate-y-1.5">
      <div className="flex items-center gap-4">
        <div className={`font-display grid h-16 w-16 shrink-0 place-items-center rounded-full text-[1.3rem] font-extrabold neu-inset-sm ${accent === 'rose' ? 'bg-rose/10 text-rose' : 'bg-sand text-olive-deep'}`}>
          {s.initials ?? s.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h3 className="font-display text-ink text-[1.2rem] leading-tight font-extrabold tracking-[-0.02em]">
            {s.name}
          </h3>
          {specialtyName && <Tag tone={accent === 'rose' ? 'rose' : 'olive'}>{specialtyName}</Tag>}
        </div>
      </div>

      <p className="text-ink-soft mt-5 text-[0.9rem] leading-relaxed line-clamp-3">{s.bio ?? ''}</p>

      <Link to="/lectures" className="border-line/70 text-ink-soft mt-6 flex items-center justify-between border-t pt-4 text-[0.82rem] font-medium transition-colors hover:text-rose">
        <span>{lectureCount} lectures</span>
        <span>{bookCount} books</span>
        <span className="text-rose inline-flex items-center gap-1">
          View work <span aria-hidden="true">→</span>
        </span>
      </Link>
    </article>
  );
}

function SkeletonTile() {
  return (
    <article className="bg-cream neu-raised flex flex-col rounded-[30px] p-7 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="bg-sand neu-inset-sm h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <div className="bg-sand h-5 w-32 rounded-full" />
          <div className="bg-sand h-4 w-20 rounded-full" />
        </div>
      </div>
      <div className="bg-sand mt-5 h-16 rounded-[16px]" />
      <div className="bg-sand mt-6 h-4 w-full rounded-full" />
    </article>
  );
}

export default function Scholars() {
  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState<string | 'all'>('all');
  const [scholars, setScholars] = useState<BackendScholar[]>([]);
  const [subjects, setSubjects] = useState<BackendSubject[]>([]);
  const [contents, setContents] = useState<BackendContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [schRes, subjRes, contRes] = await Promise.all([
        listPublicScholars(),
        listPublicSubjects().catch(() => ({ data: [] as BackendSubject[] })),
        listPublishedContents({ limit: 100 }).catch(() => ({ data: [] as BackendContent[], pagination: { total: 0, page: 1, limit: 100, totalPages: 1 } } as any)),
      ]);
      setScholars(schRes.data);
      setSubjects((subjRes as any).data ?? []);
      setContents((contRes as any).data ?? []);
    } catch (e: any) {
      setError(e.message || 'Failed to load scholars');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const countsByScholar = useMemo(() => {
    const map = new Map<string, { lecture: number; book: number }>();
    for (const s of scholars) map.set(s.id, { lecture: 0, book: 0 });
    for (const c of contents) {
      const isLecture = c.type === 'lecture' || c.type === 'video' || c.type === 'audio';
      const isBook = c.type === 'book' || c.type === 'document';
      for (const cs of c.scholars) {
        const cur = map.get(cs.scholarId);
        if (!cur) continue;
        if (isLecture) cur.lecture += 1;
        if (isBook) cur.book += 1;
      }
    }
    return map;
  }, [scholars, contents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scholars.filter((s) => {
      const sp = subjects.find((sub) => sub.id === s.specialtyId);
      const matchesQ = !q || s.name.toLowerCase().includes(q) || (sp?.name.toLowerCase().includes(q) ?? false);
      const matchesS = specialty === 'all' || s.specialtyId === specialty;
      return matchesQ && matchesS;
    });
  }, [scholars, subjects, query, specialty]);

  const subjectOptions = subjects.map((s) => ({ value: s.id, label: s.name.replace(/ &.*/, '') }));

  return (
    <>
      <PageHeader
        eyebrow="Learn From"
        title="Scholars"
        intro="Every item on ilmNet is traced back to its teacher. Follow a scholar's full body of work — lectures and books gathered in one place."
        meta={<StatRow items={[{ value: loading || error ? '—' : `${scholars.length}`, label: 'Scholars' }, { value: loading || error ? '—' : `${subjects.length}`, label: 'Fields' }, { value: 'Free', label: 'Access' }]} />}
      />

      <section className="px-5 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-[1180px]">
          <div className="bg-sand/70 neu-inset sticky top-[88px] z-30 rounded-[34px] p-4 sm:p-6">
            <SearchBar value={query} onChange={setQuery} placeholder="Search by scholar or field…" />
            <div className="mt-4">
              <FilterChips options={subjectOptions} active={specialty} onChange={setSpecialty} allLabel="All fields" />
            </div>
          </div>

          {loading ? (
            <>
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium">Loading scholars…</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonTile key={i} />)}
              </div>
            </>
          ) : error ? (
            <div className="mt-10 bg-cream neu-raised rounded-[24px] p-8 text-center">
              <p className="font-display text-ink text-[1.1rem] font-bold">Could not load scholars</p>
              <p className="text-ink-soft mt-2 text-[0.9rem]">{error}</p>
              <button onClick={fetchData} className="bg-rose text-cream mt-6 rounded-full px-6 py-3 text-[0.9rem] font-semibold">Try again</button>
            </div>
          ) : (
            <>
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium">
                {filtered.length} {filtered.length === 1 ? 'scholar' : 'scholars'} shown
              </p>
              {filtered.length ? (
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((s) => {
                    const c = countsByScholar.get(s.id) ?? { lecture: 0, book: 0 };
                    return <ScholarTile key={s.id} s={s} lectureCount={c.lecture} bookCount={c.book} />;
                  })}
                </div>
              ) : scholars.length === 0 ? (
                <div className="mt-10">
                  <EmptyState title="No scholars yet" body="Published scholars will appear here once added." />
                </div>
              ) : (
                <div className="mt-10">
                  <EmptyState title="No scholars match" body="Try another field or search by name." />
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
