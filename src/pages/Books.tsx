import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { usePageMeta } from '../lib/usePageMeta';
import { SearchBar, FilterChips, Tag, EmptyState, StatRow } from '../components/ui';
import { listPublishedContents, listPublicScholars, listPublicSubjects, type BackendContent, type BackendScholar, type BackendSubject } from '@/lib/api';
import { groupByCollection, type SeriesGroup } from '@/lib/series';
import { resolveCover } from '@/lib/thumbnail';
import MediaThumb from '@/components/MediaThumb';

function BookCover({ c }: { c: BackendContent }) {
  const media = resolveCover(c);
  const subj = c.subjects[0]?.subject;
  const cover = subj?.accent === 'rose' ? 'from-rose/85 to-rose-deep' : subj?.accent === 'olive' ? 'from-olive to-olive-deep' : 'from-ink/80 to-ink';
  // generated spine, always behind the image so a broken upload still shows something useful
  const spine = (
    <div className="absolute inset-0 grid place-items-center">
      <div className={`relative h-[150px] w-[112px] overflow-hidden rounded-[8px] bg-gradient-to-br ${cover} shadow-[10px_14px_26px_rgba(60,45,30,0.28)]`}>
        <div className="absolute inset-y-0 left-0 w-2.5 bg-black/20" />
        <div className="absolute inset-y-0 left-2.5 w-1 bg-white/25" />
        <div className="flex h-full flex-col justify-between p-3 pl-4">
          <span className="text-cream/80 text-[0.6rem] font-semibold uppercase tracking-[0.14em]">{c.type === 'document' ? 'Document' : 'Book'}</span>
          <div>
            <p className="font-display text-cream text-[0.92rem] leading-tight font-extrabold line-clamp-3">{c.title}</p>
            <p className="text-cream/70 mt-1 text-[0.66rem] line-clamp-1">{c.scholars[0]?.scholar?.name ?? ''}</p>
          </div>
        </div>
      </div>
    </div>
  );
  return (
    <MediaThumb
      src={media.src}
      kind={media.kind}
      testId="book-cover"
      className="bg-sand neu-inset aspect-[3/4] rounded-[22px]"
      fallback={spine}
    />
  );
}

function BookCard({ c }: { c: BackendContent }) {
  const subj = c.subjects[0]?.subject;
  const author = c.scholars[0]?.scholar?.name ?? 'Unknown';
  return (
    <Link to={`/books/${c.slug}`} className="bg-cream neu-raised group flex flex-col rounded-[30px] p-6 transition-transform duration-500 hover:-translate-y-1.5">
      <BookCover c={c} />
      <div className="flex flex-1 flex-col px-1 pt-5">
        {subj && <Tag tone={subj.accent as any}>{subj.name}</Tag>}
        <h3 className="font-display text-ink mt-3 text-[1.18rem] leading-snug font-extrabold tracking-[-0.02em] line-clamp-2">
          {c.title}
        </h3>
        <span className="text-rose mt-1.5 text-[0.9rem] font-semibold line-clamp-1">
          {author}
        </span>
        <p className="text-ink-soft mt-3 text-[0.88rem] leading-relaxed line-clamp-3">{c.description ?? ''}</p>
        <div className="border-line/70 mt-5 flex items-center justify-between border-t pt-4 text-[0.8rem]">
          <span className="text-ink-soft font-medium">{c.pages ? `${c.pages} pages` : c.type === 'document' ? 'Document' : 'Book'}</span>
          <span className="text-ink-muted">{c.year ?? ''}</span>
        </div>
      </div>
    </Link>
  );
}

function CollectionCard({ s }: { s: SeriesGroup }) {
  const subj = s.subjects[0];
  const first = s.items[0];
  const collectionCover = first ? resolveCover(first).src : s.coverUrl;
  return (
    <Link to={`/series/${encodeURIComponent(s.id)}`} className="bg-cream neu-raised group flex flex-col rounded-[30px] p-6 transition-transform duration-500 hover:-translate-y-1.5">
      <MediaThumb
        src={collectionCover}
        testId="collection-cover"
        className="bg-sand neu-inset aspect-[3/4] rounded-[22px]"
        fallback={<div className="bg-gradient-to-br from-olive/20 to-rose/20 absolute inset-0" />}
      >
        <div className="bg-cream/90 neu-raised-sm absolute left-3 top-3 flex items-center gap-2 rounded-full px-3 py-1.5">
          <span className="bg-olive h-2 w-2 rounded-full" />
          <span className="text-ink text-[0.68rem] font-bold tracking-[0.08em] uppercase">Collection · {s.count}</span>
        </div>
        <span className="bg-olive/90 text-white absolute right-3 top-3 rounded-full px-2.5 py-1 text-[0.62rem] font-bold">Archive</span>
        <div className="bg-cream neu-raised-sm text-ink absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-[14px] px-4 py-3">
          <span className="text-[0.78rem] font-semibold">{s.count} books</span>
          <span className="text-rose text-[0.78rem] font-bold">Open collection →</span>
        </div>
      </MediaThumb>
      <div className="flex flex-1 flex-col px-1 pt-5">
        {subj && <Tag tone={subj.accent as any}>{subj.name}</Tag>}
        <h3 className="font-display text-ink mt-3 text-[1.18rem] leading-snug font-extrabold tracking-[-0.02em] line-clamp-2">
          {s.title}
        </h3>
        <p className="text-ink-soft mt-3 text-[0.88rem] line-clamp-3">{s.description ?? `${s.count} books — open to see all.`}</p>
        <div className="border-line/70 mt-5 flex items-center justify-between border-t pt-4 text-[0.8rem]">
          <span className="text-ink-soft font-medium">{s.scholars[0]?.name ?? 'Collection'}</span>
          <span className="text-ink-muted">{s.provider}</span>
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <article className="bg-cream neu-raised flex flex-col rounded-[30px] p-6 animate-pulse">
      <div className="bg-sand neu-inset aspect-[3/4] rounded-[22px]" />
      <div className="mt-5 space-y-3">
        <div className="bg-sand h-4 w-24 rounded-full" />
        <div className="bg-sand h-6 w-full rounded-full" />
        <div className="bg-sand h-4 w-3/4 rounded-full" />
        <div className="bg-sand h-3 w-full rounded-full" />
      </div>
    </article>
  );
}

export default function Books() {
  usePageMeta({
    title: 'Books',
    description:
      'Classical texts and contemporary works in the ilmNet library — search by title, subject or scholar. Free to read, always linked to the original source.',
    path: '/books',
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const urlQ = searchParams.get('q') ?? '';
  const urlScholar = searchParams.get('scholar') ?? 'all';
  const urlSubject = searchParams.get('subject') ?? 'all';
  const urlType = searchParams.get('type') ?? 'all';

  const [inputQ, setInputQ] = useState(urlQ);
  useEffect(() => setInputQ(urlQ), [urlQ]);
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

  const typeFilter = useMemo(() => {
    if (urlType === 'book' || urlType === 'document') return urlType;
    return 'all';
  }, [urlType]);

  const [contents, setContents] = useState<BackendContent[]>([]);
  const [scholars, setScholars] = useState<BackendScholar[]>([]);
  const [subjects, setSubjects] = useState<BackendSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scholarBySlug = useMemo(() => new Map(scholars.map(s => [s.slug, s])), [scholars]);
  const subjectBySlug = useMemo(() => new Map(subjects.map(s => [s.slug, s])), [subjects]);

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

        let typeForApi: string | undefined;
        if (!typeParam || typeParam === 'all') typeForApi = 'book,document';
        else if (typeParam === 'book' || typeParam === 'document') typeForApi = typeParam;
        else typeForApi = typeParam;

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
        if (!cancelled) setError(e.message || 'Failed to load books');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [searchParams]);

  const subjectOptions = subjects.map((s) => ({ value: s.slug, label: s.name.replace(/ &.*/, '') }));
  const scholarChipOptions = scholars.map((s) => ({ value: s.slug, label: s.name }));
  const formatOptions = [
    { value: 'book', label: 'Books' },
    { value: 'document', label: 'Documents' },
  ];

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: false });
  }

  const hasActiveFilters = urlQ || urlScholar !== 'all' || urlSubject !== 'all' || typeFilter !== 'all';
  const { series, standalone } = useMemo(() => groupByCollection(contents), [contents]);

  function clearAll() {
    setInputQ('');
    setSearchParams(new URLSearchParams(), { replace: false });
  }

  return (
    <>
      <PageHeader
        eyebrow="Read & Reflect"
        title="Books"
        intro="Classical texts and contemporary works — search by title, subject or scholar. Filters are shareable via the URL."
        meta={<StatRow items={[{ value: loading || error ? '—' : `${contents.length}`, label: 'Items' }, { value: loading || error ? '—' : `${series.length}`, label: 'Collections' }, { value: 'Free', label: 'To read' }]} />}
      />

      <section className="px-5 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-[1180px]">
          <div className="bg-sand/70 neu-inset sticky top-[88px] z-30 rounded-[34px] p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="lg:flex-1">
                <SearchBar value={inputQ} onChange={setInputQ} placeholder="Search titles, authors, descriptions…" label="Search books" />
              </div>
              {hasActiveFilters && (
                <button onClick={clearAll} className="bg-cream neu-raised-sm text-ink hover:text-rose shrink-0 rounded-full px-5 py-3 text-[0.86rem] font-semibold transition-colors">
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
                <p className="text-ink-muted mb-2 text-[0.7rem] font-semibold tracking-[0.14em] uppercase">Edition</p>
                <FilterChips options={formatOptions} active={typeFilter as any} onChange={(v) => updateParam('type', v as string)} allLabel="All formats" />
              </div>
              {hasActiveFilters && (
                <p className="text-ink-muted text-[0.74rem]">
                  Filters: {urlQ ? `“${urlQ}”` : ''} {urlScholar !== 'all' ? `· ${scholarBySlug.get(urlScholar)?.name ?? urlScholar}` : ''} {urlSubject !== 'all' ? `· ${subjectBySlug.get(urlSubject)?.name ?? urlSubject}` : ''} {typeFilter !== 'all' ? `· ${typeFilter}` : ''} <span className="text-ink-soft">— share this URL</span>
                </p>
              )}
            </div>
          </div>

          {loading ? (
            <>
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium">Searching books…</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            </>
          ) : error ? (
            <div className="mt-10 bg-cream neu-raised rounded-[24px] p-8 text-center">
              <p className="font-display text-ink text-[1.1rem] font-bold">Could not load books</p>
              <p className="text-ink-soft mt-2 text-[0.9rem]">{error}</p>
              <button onClick={() => window.location.reload()} className="bg-rose text-cream mt-6 rounded-full px-6 py-3 text-[0.9rem] font-semibold">Try again</button>
            </div>
          ) : (
            <>
              {/* Fase 5.5: screen readers hear the result of a filter without moving focus. */}
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium" role="status" aria-live="polite">
                {contents.length} books found · {series.length} collections, {standalone.length} singles
              </p>

              {series.length > 0 && (
                <>
                  <h2 className="font-display text-ink mt-8 text-[1.35rem] font-extrabold tracking-[-0.02em]">Collections</h2>
                  <p className="text-ink-muted mt-1 text-[0.82rem]">A collection gathers all its titles — open the collection to see the books.</p>
                  <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {series.map((s) => (
                      <CollectionCard key={s.id} s={s} />
                    ))}
                  </div>
                </>
              )}

              {standalone.length > 0 && (
                <>
                  <h2 className="font-display text-ink mt-10 text-[1.35rem] font-extrabold tracking-[-0.02em]">{series.length ? 'Single books' : 'Books'}</h2>
                  <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {standalone.map((c) => (
                      <BookCard key={c.id} c={c} />
                    ))}
                  </div>
                </>
              )}

              {contents.length === 0 && (
                <div className="mt-10">
                  {/* Fase 5.5: with no filters set, "try another search term" was advice about
                      filters the visitor had not applied yet — an empty library needs its own text. */}
                  {hasActiveFilters ? (
                    <EmptyState title="No books match" body="Try a different search term, scholar, subject or edition. Your filters are shareable via the URL." />
                  ) : (
                    <EmptyState title="No books yet" body="The book shelf is still empty. Titles appear here as soon as they are published." />
                  )}
                  <div className="mt-6 flex justify-center">
                    {hasActiveFilters && (
                      <button onClick={clearAll} className="bg-rose text-cream rounded-full px-6 py-3 text-[0.9rem] font-semibold">Clear all filters</button>
                    )}
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
