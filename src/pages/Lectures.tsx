import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { SearchBar, FilterChips, Tag, EmptyState, StatRow } from '../components/ui';
import { formatCount, formatDuration } from '../data';
import { listPublishedContents, listPublicScholars, listPublicSubjects, type BackendContent, type BackendScholar, type BackendSubject } from '@/lib/api';

function PlayGlyph({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 5.6c0-.9 1-1.5 1.8-1l8.1 5.1a1.2 1.2 0 0 1 0 2L9.8 17c-.8.5-1.8-.1-1.8-1V5.6Z" />
    </svg>
  );
}

function LectureCard({ c }: { c: BackendContent }) {
  const subj = c.subjects[0]?.subject;
  const scholarName = c.scholars[0]?.scholar?.name ?? 'Unknown scholar';
  const isVideo = c.type === 'video' || c.type === 'lecture';
  const format: 'Audio' | 'Video' = c.type === 'audio' ? 'Audio' : 'Video';
  const thumb = c.thumbnailUrl;
  return (
    <Link to={`/lectures/${c.slug}`} className="bg-cream neu-raised group flex flex-col rounded-[30px] p-6 transition-transform duration-500 hover:-translate-y-1.5">
      <div className="bg-sand neu-inset relative flex h-40 items-center justify-center overflow-hidden rounded-[22px]">
        {thumb ? (
          <img src={thumb} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
        ) : (
          <div className="absolute inset-x-0 bottom-0 flex h-12 items-end gap-[3px] px-5 pb-3 opacity-40">
            {Array.from({ length: 28 }).map((_, i) => (
              <span key={i} style={{ height: `${12 + ((i * 13) % 60)}%` }} className={i % 3 === 0 ? 'bg-rose/50 flex-1 rounded-full' : 'bg-olive/40 flex-1 rounded-full'} />
            ))}
          </div>
        )}
        <button className="bg-cream neu-raised-sm text-rose group-hover:scale-[1.06] relative grid h-16 w-16 place-items-center rounded-full transition-transform" tabIndex={-1} aria-hidden="true">
          <PlayGlyph className="h-7 w-7" />
        </button>
        <span className="bg-cream/90 text-ink neu-raised-sm absolute right-3 top-3 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold">
          {format}
        </span>
        {c.provider === 'youtube' && <span className="bg-rose/90 text-cream absolute left-3 top-3 rounded-full px-2.5 py-1 text-[0.62rem] font-bold">YouTube</span>}
        {c.provider === 'archive' && <span className="bg-olive/90 text-white absolute left-3 top-3 rounded-full px-2.5 py-1 text-[0.62rem] font-bold">Archive</span>}
      </div>

      <div className="flex flex-1 flex-col px-1 pt-5">
        <div className="flex items-center gap-2 flex-wrap">
          {subj && <Tag tone={subj.accent as any}>{subj.name}</Tag>}
          <Tag tone="plain">{isVideo ? 'Video' : 'Audio'}</Tag>
          {c.language && <span className="bg-sand text-ink-soft rounded-full px-2.5 py-1 text-[0.62rem] font-medium">{c.language}</span>}
        </div>
        <h3 className="font-display text-ink mt-3 text-[1.18rem] leading-snug font-extrabold tracking-[-0.02em] line-clamp-2">
          {c.title}
        </h3>
        <span className="text-rose mt-2 text-[0.9rem] font-semibold line-clamp-1">
          {scholarName}
        </span>
        <p className="text-ink-muted mt-3 text-[0.84rem] line-clamp-2">
          {c.series ? `${c.series} · ` : ''}{c.episodes ? `${c.episodes} episodes` : c.description ? (c.description.slice(0, 80) + (c.description.length > 80 ? '…' : '')) : ''}
        </p>

        <div className="border-line/70 mt-5 flex items-center justify-between border-t pt-4 text-[0.8rem]">
          <span className="text-ink-soft font-medium">{c.durationMin ? formatDuration(c.durationMin) + ' / ep' : c.year ? `${c.year}` : '—'}</span>
          <span className="text-ink-muted">{c.provider === 'youtube' ? 'Watch' : c.provider === 'archive' ? 'Archive' : ''}</span>
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <article className="bg-cream neu-raised flex flex-col rounded-[30px] p-6 animate-pulse">
      <div className="bg-sand neu-inset h-40 rounded-[22px]" />
      <div className="mt-5 space-y-3">
        <div className="bg-sand h-4 w-24 rounded-full" />
        <div className="bg-sand h-6 w-full rounded-full" />
        <div className="bg-sand h-4 w-3/4 rounded-full" />
        <div className="bg-sand h-3 w-2/3 rounded-full" />
      </div>
    </article>
  );
}

export default function Lectures() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQ = searchParams.get('q') ?? '';
  const urlScholar = searchParams.get('scholar') ?? 'all';
  const urlSubject = searchParams.get('subject') ?? 'all';
  const urlFormat = (searchParams.get('type') ?? 'all') as string;

  // local input for debounced search
  const [inputQ, setInputQ] = useState(urlQ);
  useEffect(() => setInputQ(urlQ), [urlQ]);

  // debounce q -> URL
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
  }, [inputQ]); // eslint-disable-line react-hooks/exhaustive-deps

  // derive format state from URL type param
  // URL type for lectures: 'all' | 'audio' | 'video'  (video maps to lecture,video)
  const format: 'all' | 'Audio' | 'Video' = useMemo(() => {
    if (urlFormat === 'audio') return 'Audio';
    if (urlFormat === 'video' || urlFormat === 'lecture,video' || urlFormat === 'lecture') return 'Video';
    return 'all';
  }, [urlFormat]);

  const [contents, setContents] = useState<BackendContent[]>([]);
  const [scholars, setScholars] = useState<BackendScholar[]>([]);
  const [subjects, setSubjects] = useState<BackendSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // map slug -> id helpers for display but backend now accepts slug directly
  const scholarBySlug = useMemo(() => new Map(scholars.map(s => [s.slug, s])), [scholars]);
  const subjectBySlug = useMemo(() => new Map(subjects.map(s => [s.slug, s])), [subjects]);

  // fetch scholars/subjects once
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listPublicScholars().catch(() => ({ data: [] as BackendScholar[] })),
      listPublicSubjects().catch(() => ({ data: [] as BackendSubject[] })),
    ]).then(([schRes, subjRes]) => {
      if (cancelled) return;
      setScholars((schRes as any).data ?? []);
      setSubjects((subjRes as any).data ?? []);
    });
    return () => { cancelled = true; };
  }, []);

  // fetch contents server-side whenever URL filters change
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const q = searchParams.get('q') ?? undefined;
        const scholar = searchParams.get('scholar') ?? undefined;
        const subject = searchParams.get('subject') ?? undefined;
        const typeParam = searchParams.get('type') ?? undefined;

        // map type param: if absent -> base lecture types; if 'video' -> lecture,video
        let typeForApi: string | undefined;
        if (!typeParam || typeParam === 'all') typeForApi = 'lecture,video,audio';
        else if (typeParam === 'Video' || typeParam === 'video') typeForApi = 'lecture,video';
        else if (typeParam === 'Audio' || typeParam === 'audio') typeForApi = 'audio';
        else typeForApi = typeParam; // allow raw like 'lecture,video'

        const params: Record<string, string | number | undefined> = {
          limit: 100,
          type: typeForApi,
        };
        if (q?.trim()) params.q = q.trim();
        if (scholar && scholar !== 'all') params.scholar = scholar;
        if (subject && subject !== 'all') params.subject = subject;

        const res = await listPublishedContents(params);
        if (!cancelled) setContents(res.data);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load lectures');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [searchParams]);

  const subjectOptions = subjects.map((s) => ({ value: s.slug, label: s.name.replace(/ &.*/, '') }));
  const scholarChipOptions = scholars.map((s) => ({ value: s.slug, label: s.name }));

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: false });
  }

  const hasActiveFilters = urlQ || urlScholar !== 'all' || urlSubject !== 'all' || format !== 'all';
  const totalListens = contents.length * 120;

  function clearAll() {
    setInputQ('');
    setSearchParams(new URLSearchParams(), { replace: false });
  }

  return (
    <>
      <PageHeader
        eyebrow="Listen & Learn"
        title="Lectures"
        intro="Full courses, single talks and ongoing series — ordered into sequences you can actually finish. Search and filter — share your view via URL."
        meta={
          <StatRow
            items={[
              { value: loading ? '—' : `${contents.length}`, label: 'Results' },
              { value: loading ? '—' : formatCount(totalListens), label: 'Listens' },
              { value: 'Free', label: 'Always' },
            ]}
          />
        }
      />

      <section className="px-5 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-[1180px]">
          <div className="bg-sand/70 neu-inset sticky top-[88px] z-30 rounded-[34px] p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="lg:flex-1">
                <SearchBar value={inputQ} onChange={setInputQ} placeholder="Search lectures, scholars, series…" />
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearAll}
                  className="bg-cream neu-raised-sm text-ink hover:text-rose shrink-0 rounded-full px-5 py-3 text-[0.86rem] font-semibold transition-colors"
                >
                  Reset filters
                </button>
              )}
            </div>
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <p className="text-ink-muted mb-2 text-[0.7rem] font-semibold tracking-[0.14em] uppercase">Scholar</p>
                <FilterChips options={scholarChipOptions} active={urlScholar as any} onChange={(v) => updateParam('scholar', v as string)} allLabel="All scholars" />
              </div>
              <div>
                <p className="text-ink-muted mb-2 text-[0.7rem] font-semibold tracking-[0.14em] uppercase">Subject</p>
                <FilterChips options={subjectOptions} active={urlSubject as any} onChange={(v) => updateParam('subject', v as string)} allLabel="All subjects" />
              </div>
              <div>
                <p className="text-ink-muted mb-2 text-[0.7rem] font-semibold tracking-[0.14em] uppercase">Format</p>
                <FilterChips options={[{ value: 'Audio', label: 'Audio' }, { value: 'Video', label: 'Video' }]} active={format as any} onChange={(v) => {
                  const mapped = v === 'all' ? 'all' : v === 'Audio' ? 'audio' : 'video';
                  updateParam('type', mapped);
                }} allLabel="All formats" />
              </div>
              {hasActiveFilters && (
                <p className="text-ink-muted text-[0.74rem]">
                  Filters: {urlQ ? `“${urlQ}”` : ''} {urlScholar !== 'all' ? `· ${scholarBySlug.get(urlScholar)?.name ?? urlScholar}` : ''} {urlSubject !== 'all' ? `· ${subjectBySlug.get(urlSubject)?.name ?? urlSubject}` : ''} {format !== 'all' ? `· ${format}` : ''} <span className="text-ink-soft">— share this URL</span>
                </p>
              )}
            </div>
          </div>

          {loading ? (
            <>
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium">Searching lectures…</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            </>
          ) : error ? (
            <div className="mt-10 bg-cream neu-raised rounded-[24px] p-8 text-center">
              <p className="font-display text-ink text-[1.1rem] font-bold">Could not load lectures</p>
              <p className="text-ink-soft mt-2 text-[0.9rem]">{error}</p>
              <button onClick={() => window.location.reload()} className="bg-rose text-cream mt-6 rounded-full px-6 py-3 text-[0.9rem] font-semibold">Try again</button>
            </div>
          ) : (
            <>
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium">
                {contents.length} {contents.length === 1 ? 'lecture' : 'lectures'} found
              </p>

              {contents.length ? (
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {contents.map((c) => (
                    <LectureCard key={c.id} c={c} />
                  ))}
                </div>
              ) : (
                <div className="mt-10">
                  <EmptyState title="No lectures match" body="Try a different search term, scholar, subject or format. Your filters are shareable via the URL." />
                  <div className="mt-6 flex justify-center">
                    <button onClick={clearAll} className="bg-rose text-cream rounded-full px-6 py-3 text-[0.9rem] font-semibold">Clear all filters</button>
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
