import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { usePageMeta } from '../lib/usePageMeta';
import { SearchBar, FilterChips, EmptyState, StatRow } from '../components/ui';
import { listPublicScholars, listPublicSubjects, listPublishedContents, type BackendScholar, type BackendSubject, type BackendContent } from '@/lib/api';
// Discovery step D0: the tile lives in the shared card module now (the hub in D3 extends it).
import { ScholarTile, TileSkeleton } from '@/components/cards';

export default function Scholars() {
  usePageMeta({
    title: 'Scholars',
    description:
      'Every item on ilmNet is traced back to its teacher. Follow a scholar’s lectures, books and series gathered in one place.',
    path: '/scholars',
  });

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
            <SearchBar value={query} onChange={setQuery} placeholder="Search by scholar or field…" label="Search scholars" />
            <div className="mt-4">
              <FilterChips options={subjectOptions} active={specialty} onChange={setSpecialty} allLabel="All fields" />
            </div>
          </div>

          {loading ? (
            <>
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium">Loading scholars…</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <TileSkeleton key={i} />)}
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
