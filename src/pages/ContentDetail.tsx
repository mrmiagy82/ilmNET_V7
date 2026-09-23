import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { Tag } from '../components/ui';
import { getPublishedContent, listPublishedContents, type BackendContent } from '@/lib/api';
import AudioPlayer from '@/components/AudioPlayer';
import { getDownloadUrl, getAudioStreamUrl } from '@/lib/series';
import { resolveCover, resolveThumbnail, resolveCardMedia } from '@/lib/thumbnail';
import AudioPlaceholder from '@/components/AudioPlaceholder';

function Embed({ c }: { c: BackendContent }) {
  const audioSrc = c.type === 'audio' ? getAudioStreamUrl(c) : null;
  const downloadUrl = getDownloadUrl(c);

  // Audio: use custom player
  if (c.type === 'audio') {
    return (
      <div className="space-y-4">
        <AudioPlayer src={audioSrc} title={c.title} embedFallback={c.embedUrl} provider={c.provider} sourceUrl={c.sourceUrl} />
        {downloadUrl && (
          <div className="flex justify-center">
            <a href={downloadUrl} target="_blank" rel="noreferrer" className="bg-cream neu-raised-sm text-ink hover:text-rose inline-flex items-center gap-2 rounded-full px-6 py-3 text-[0.86rem] font-semibold">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
              Download audio
            </a>
          </div>
        )}
        {!downloadUrl && c.provider === 'archive' && (
          <p className="text-ink-muted text-center text-[0.72rem]">Download via <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-rose font-semibold">Archive.org</a></p>
        )}
      </div>
    );
  }

  // PDF: use object/embed
  if (c.provider === 'pdf') {
    return (
      <div className="bg-sand neu-inset rounded-[24px] overflow-hidden">
        <iframe src={c.embedUrl ?? c.sourceUrl} title={c.title} className="h-[720px] w-full bg-white" />
        <div className="p-4 flex flex-wrap items-center justify-between gap-3">
          <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-rose text-[0.88rem] font-semibold">
            Open PDF → {c.sourceUrl}
          </a>
          {downloadUrl && (
            <a href={downloadUrl} target="_blank" rel="noreferrer" className="bg-cream neu-raised-sm text-ink rounded-full px-5 py-2.5 text-[0.82rem] font-semibold">Download PDF</a>
          )}
        </div>
      </div>
    );
  }

  // Book/document with archive PDF — show iframe + download
  if ((c.type === 'book' || c.type === 'document') && c.provider === 'archive') {
    return (
      <div className="bg-sand neu-inset rounded-[24px] overflow-hidden">
        {c.embedUrl ? (
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-white sm:aspect-[16/10]">
            <iframe src={c.embedUrl} title={c.title} className="absolute inset-0 h-full w-full bg-white" allowFullScreen />
          </div>
        ) : (
          <div className="p-8 text-center text-ink-muted">No embed available</div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <span className="text-ink-muted text-[0.72rem] font-medium">Archive.org · {c.type} · {c.provider}</span>
          <div className="flex gap-2">
            {downloadUrl ? (
              <a href={downloadUrl} target="_blank" rel="noreferrer" className="bg-cream neu-raised-sm text-ink rounded-full px-5 py-2.5 text-[0.82rem] font-semibold">Download PDF</a>
            ) : (
              <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="bg-cream neu-raised-sm text-ink rounded-full px-5 py-2.5 text-[0.82rem] font-semibold">Open on Archive.org</a>
            )}
            <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-ink-soft hover:text-rose text-[0.78rem] font-semibold px-3 py-2.5">Open original ↗</a>
          </div>
        </div>
      </div>
    );
  }

  // Default iframe for youtube, archive video, google_books, external with embed
  if (!c.embedUrl) {
    return (
      <div className="bg-sand neu-inset rounded-[24px] p-8 text-center">
        <p className="text-ink-muted text-[0.9rem]">No embed available — open original:</p>
        <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-rose mt-3 inline-block font-semibold break-all">
          {c.sourceUrl}
        </a>
        {downloadUrl && (
          <div className="mt-4">
            <a href={downloadUrl} target="_blank" rel="noreferrer" className="bg-cream neu-raised-sm text-ink rounded-full px-5 py-2.5 text-[0.82rem] font-semibold">Download</a>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-sand neu-inset rounded-[24px] overflow-hidden p-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-[18px] bg-black">
        <iframe
          src={c.embedUrl}
          title={c.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-3">
        <span className="text-ink-muted text-[0.72rem] font-medium">
          {c.provider === 'youtube' ? 'YouTube' : c.provider === 'archive' ? 'Archive.org' : c.provider === 'google_books' ? 'Google Books' : c.provider} · {c.type}
        </span>
        <div className="flex gap-2">
          {downloadUrl && (
            <a href={downloadUrl} target="_blank" rel="noreferrer" className="bg-cream neu-raised-sm text-ink rounded-full px-4 py-1.5 text-[0.72rem] font-semibold">Download</a>
          )}
          <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-ink-soft hover:text-rose text-[0.78rem] font-semibold">
            Open original ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function SeriesNav({ c }: { c: BackendContent }) {
  const [siblings, setSiblings] = useState<BackendContent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!c.collectionIdentifier) return;
    let cancelled = false;
    setLoading(true);
    listPublishedContents({ limit: 100, q: c.collectionIdentifier })
      .then((res) => {
        if (cancelled) return;
        let filtered = (res.data as BackendContent[]).filter((x) => x.collectionIdentifier === c.collectionIdentifier && x.id !== c.id);
        if (filtered.length === 0) {
          // fallback fetch all
          return listPublishedContents({ limit: 100 }).then((all) => {
            if (cancelled) return;
            filtered = (all.data as BackendContent[]).filter((x) => x.collectionIdentifier === c.collectionIdentifier && x.id !== c.id);
            filtered.sort((a, b) => a.title.localeCompare(b.title));
            setSiblings(filtered.slice(0, 6));
          });
        } else {
          filtered.sort((a, b) => a.title.localeCompare(b.title));
          setSiblings(filtered.slice(0, 6));
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [c.collectionIdentifier, c.id]);

  if (!c.collectionIdentifier || (!loading && siblings.length === 0)) return null;

  return (
    <div className="bg-cream neu-raised rounded-[28px] p-6 sm:p-8">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-ink text-[1.1rem] font-bold">More in this series</h3>
        <Link to={`/series/${encodeURIComponent(c.collectionIdentifier!)}`} className="text-rose text-[0.82rem] font-semibold">View all →</Link>
      </div>
      <p className="text-ink-muted mt-1 text-[0.78rem]">{c.collectionTitle || c.collectionIdentifier} · {siblings.length + 1} parts</p>
      <div className="mt-4 grid gap-3">
        {siblings.map((s) => (
          <Link key={s.id} to={`/${s.type === 'book' || s.type === 'document' ? 'books' : 'lectures'}/${s.slug}`} className="bg-sand neu-inset flex gap-3 rounded-[16px] p-3 hover:opacity-80">
            <div className="bg-cream relative h-16 w-24 shrink-0 overflow-hidden rounded-[10px]">
              {(() => {
                const media = resolveCardMedia(s);
                if (media.src) return <img src={media.src} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />;
                if (media.kind === 'placeholder-audio') return <AudioPlaceholder className="absolute inset-0" />;
                return <div className="absolute inset-0 bg-gradient-to-br from-olive/10 to-rose/10" />;
              })()}
            </div>
            <div className="min-w-0">
              <p className="font-display text-ink line-clamp-1 text-[0.88rem] font-bold">{s.title}</p>
              <p className="text-ink-muted line-clamp-1 text-[0.72rem]">{s.scholars[0]?.scholar.name ?? ''} · {s.durationMin ? `${s.durationMin} min` : s.type}</p>
            </div>
          </Link>
        ))}
        {loading && <p className="text-ink-muted text-[0.78rem]">Loading series…</p>}
      </div>
    </div>
  );
}

export default function ContentDetail({ expectedType }: { expectedType?: 'lecture' | 'book' }) {
  const { id } = useParams<{ id: string }>();
  const [content, setContent] = useState<BackendContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    getPublishedContent(id)
      .then((res) => {
        setContent(res.data);
      })
      .catch((e: any) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id, expectedType]);

  if (loading) {
    return (
      <>
        <PageHeader eyebrow={expectedType === 'book' ? 'Read & Reflect' : 'Listen & Learn'} title="Loading…" intro="Fetching content from the library." />
        <section className="px-5 pb-24 sm:px-6 lg:pb-32">
          <div className="mx-auto max-w-[860px]">
            <div className="bg-sand neu-inset rounded-[24px] h-[400px] animate-pulse" />
            <div className="mt-8 space-y-3">
              <div className="bg-sand h-8 w-3/4 rounded-full animate-pulse" />
              <div className="bg-sand h-4 w-full rounded-full animate-pulse" />
              <div className="bg-sand h-4 w-2/3 rounded-full animate-pulse" />
            </div>
          </div>
        </section>
      </>
    );
  }

  if (error || !content) {
    return (
      <>
        <PageHeader eyebrow="Not found" title="Content not found" intro={error ?? 'This content does not exist or is not published.'} />
        <section className="px-5 pb-24 sm:px-6">
          <div className="mx-auto max-w-[860px]">
            <div className="bg-cream neu-raised rounded-[24px] p-8 text-center">
              <p className="font-display text-ink text-[1.1rem] font-bold">Could not load content</p>
              <p className="text-ink-soft mt-2 text-[0.9rem] break-words">{error ?? 'Not found'}</p>
              <div className="mt-6 flex justify-center gap-3">
                <Link to={expectedType === 'book' ? '/books' : '/lectures'} className="bg-rose text-cream rounded-full px-6 py-3 text-[0.9rem] font-semibold">
                  Back to {expectedType === 'book' ? 'books' : 'lectures'}
                </Link>
                <Link to="/" className="bg-sand text-ink rounded-full px-6 py-3 text-[0.9rem] font-semibold">
                  Home
                </Link>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  const c = content;
  const scholars = c.scholars.map((s) => s.scholar);
  const subjects = c.subjects.map((s) => s.subject);
  const downloadUrl = getDownloadUrl(c);

  return (
    <>
      <PageHeader
        eyebrow={`${c.provider === 'youtube' ? 'YouTube' : c.provider === 'archive' ? 'Archive.org' : c.provider} · ${c.type}`}
        title={c.title}
        intro={c.description ? c.description.slice(0, 220) + (c.description.length > 220 ? '…' : '') : 'No description.'}
        meta={
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {subjects.map((sub) => (
                <Tag key={sub.id} tone={sub.accent as any}>{sub.name}</Tag>
              ))}
              {c.language && <span className="bg-sand text-ink-soft rounded-full px-3 py-1.5 text-[0.72rem] font-medium">{c.language}</span>}
              {c.durationMin && <span className="bg-cream neu-inset rounded-full px-3 py-1.5 text-[0.72rem] font-medium">{c.durationMin} min</span>}
              {c.pages && <span className="bg-cream neu-inset rounded-full px-3 py-1.5 text-[0.72rem] font-medium">{c.pages} pages</span>}
              {c.year && <span className="bg-cream neu-inset rounded-full px-3 py-1.5 text-[0.72rem] font-medium">{c.year}</span>}
            </div>
            {scholars.length > 0 && (
              <p className="text-ink-soft text-[0.88rem]">
                By {scholars.map((s) => s.name).join(', ')} {c.series ? `· ${c.series}` : ''} {c.collectionTitle ? `· ${c.collectionTitle}` : ''}
              </p>
            )}
            {c.collectionIdentifier && (
              <Link to={`/series/${encodeURIComponent(c.collectionIdentifier)}`} className="text-rose inline-flex items-center gap-1 text-[0.82rem] font-semibold hover:gap-1.5 transition-all">
                View series: {c.collectionTitle || c.collectionIdentifier} →
              </Link>
            )}
          </div>
        }
      />

      <section className="px-5 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-[860px] space-y-8">
          <Embed c={c} />

          <div className="bg-cream neu-raised rounded-[28px] p-6 sm:p-8">
            <h2 className="font-display text-ink text-[1.4rem] font-extrabold">About</h2>
            <p className="text-ink-soft mt-4 whitespace-pre-wrap text-[1rem] leading-[1.7]">{c.description ?? 'No description provided.'}</p>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <div className="bg-sand neu-inset rounded-[18px] p-4">
                <p className="text-ink-muted text-[0.68rem] font-semibold tracking-[0.14em] uppercase">Scholars</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {scholars.length ? scholars.map((s) => (
                    <span key={s.id} className="bg-cream neu-raised-sm rounded-full px-3 py-1.5 text-[0.82rem] font-semibold">{s.name}</span>
                  )) : <span className="text-ink-muted text-[0.82rem]">—</span>}
                </div>
              </div>
              <div className="bg-sand neu-inset rounded-[18px] p-4">
                <p className="text-ink-muted text-[0.68rem] font-semibold tracking-[0.14em] uppercase">Subjects</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {subjects.length ? subjects.map((s) => (
                    <Link key={s.id} to={`/lectures?subject=${s.slug}`} className="bg-cream neu-raised-sm rounded-full px-3 py-1.5 text-[0.82rem] font-semibold hover:text-rose">{s.name}</Link>
                  )) : <span className="text-ink-muted text-[0.82rem]">—</span>}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="bg-cream neu-inset rounded-[16px] px-4 py-3">
                <p className="text-ink-muted text-[0.68rem] font-semibold tracking-[0.12em] uppercase">Provider</p>
                <p className="text-ink mt-1 text-[0.88rem] font-semibold capitalize">{c.provider.replace('_', ' ')}</p>
                <p className="text-ink-muted mt-1 break-all text-[0.7rem] font-mono">{c.sourceUrl}</p>
              </div>
              <div className="bg-cream neu-inset rounded-[16px] px-4 py-3">
                <p className="text-ink-muted text-[0.68rem] font-semibold tracking-[0.12em] uppercase">Language</p>
                <p className="text-ink mt-1 text-[0.88rem] font-semibold">{c.language ?? '—'}</p>
                {c.durationMin && <p className="text-ink-muted mt-1 text-[0.7rem]">{c.durationMin} min</p>}
                {c.pages && <p className="text-ink-muted mt-1 text-[0.7rem]">{c.pages} pages</p>}
              </div>
              <div className="bg-cream neu-inset rounded-[16px] px-4 py-3">
                <p className="text-ink-muted text-[0.68rem] font-semibold tracking-[0.12em] uppercase">Collection</p>
                <p className="text-ink mt-1 text-[0.88rem] font-semibold">{c.collectionTitle ?? '—'}</p>
                {c.collectionIdentifier && <p className="text-ink-muted mt-1 text-[0.7rem] font-mono">{c.collectionIdentifier}</p>}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={c.type === 'book' || c.type === 'document' ? '/books' : '/lectures'} className="bg-sand text-ink rounded-full px-6 py-3 text-[0.9rem] font-semibold">
                Back to {c.type === 'book' || c.type === 'document' ? 'books' : 'lectures'}
              </Link>
              <Link to="/" className="bg-cream neu-raised-sm text-ink rounded-full px-6 py-3 text-[0.9rem] font-semibold">
                Home
              </Link>
              {downloadUrl && (
                <a href={downloadUrl} target="_blank" rel="noreferrer" className="bg-olive text-white rounded-full px-6 py-3 text-[0.9rem] font-semibold">
                  Download
                </a>
              )}
              {!downloadUrl && c.provider === 'archive' && (
                <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="bg-sand text-ink rounded-full px-6 py-3 text-[0.9rem] font-semibold">
                  Open on Archive.org
                </a>
              )}
            </div>
          </div>

          <SeriesNav c={c} />

          {(() => {
            const coverMedia = c.type === 'book' || c.type === 'document' ? resolveCover(c) : resolveThumbnail(c);
            const audioFallback = c.type === 'audio' && !coverMedia.src;
            if (!coverMedia.src && !audioFallback) return null;
            return (
              <div className="bg-cream neu-raised rounded-[28px] p-6 sm:p-8">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-ink text-[1.1rem] font-bold">{c.type === 'book' || c.type === 'document' ? 'Cover' : 'Artwork'}</h3>
                  {coverMedia.source === 'custom' && <span className="bg-olive/15 text-olive-deep rounded-full px-3 py-1 text-[0.68rem] font-bold">Custom upload</span>}
                </div>
                <div className="bg-sand neu-inset mt-4 overflow-hidden rounded-[18px] p-2">
                  {coverMedia.src ? (
                    <img src={coverMedia.src} alt="" className="max-h-[420px] w-full rounded-[14px] bg-sand object-contain" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
                  ) : (
                    <AudioPlaceholder className="aspect-[16/10] w-full rounded-[14px]" />
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </section>
    </>
  );
}
