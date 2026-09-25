import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { YouTubeCollectionResult, YouTubeDetectedItem, YouTubeImportDraft } from './data';
import type { ArchiveContentType } from './data';
import { useAdmin } from './store';
import { previewYouTube, confirmYouTube } from '@/lib/api';
import {
  ErrorBanner,
  Field,
  GhostButton,
  PageIntro,
  PrimaryButton,
  SelectInput,
  TextArea,
  TextInput,
} from './ui';

function defaultContentTypeForKind(k: YouTubeDetectedItem['kind']): ArchiveContentType {
  if (k === 'video') return 'video';
  if (k === 'playlist') return 'video';
  return 'video';
}

function kindBadge(kind: YouTubeDetectedItem['kind']) {
  const map: Record<string, string> = {
    video: 'bg-rose/10 text-rose',
    playlist: 'bg-olive/10 text-olive-deep',
    unknown: 'bg-sand text-ink-muted',
  };
  return map[kind] ?? 'bg-sand text-ink-muted';
}

export default function YouTubeImportPage() {
  const navigate = useNavigate();
  const { scholars, subjects, flash, refresh } = useAdmin();

  const [url, setUrl] = useState('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const [result, setResult] = useState<YouTubeCollectionResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<YouTubeImportDraft[]>([]);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<string | 'all'>('all');
  const [providerNote, setProviderNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [page, setPage] = useState(1);
  const [bulkScholar, setBulkScholar] = useState('');
  const [bulkSubject, setBulkSubject] = useState('');
  const [bulkLang, setBulkLang] = useState('');
  const pageSize = 20;

  const handleDetect = async () => {
    if (!url.trim()) {
      setProviderNote('Paste a YouTube URL first — e.g. https://www.youtube.com/watch?v=..., https://youtu.be/..., /shorts/..., /embed/... or a playlist link');
      return;
    }
    setLoading(true);
    setProviderNote(null);
    try {
      const res = await previewYouTube(url.trim());
      const mapped: YouTubeCollectionResult = {
        sourceUrl: res.sourceUrl,
        identifier: res.identifier,
        title: res.title,
        description: res.description,
        totalItems: res.totalItems,
        items: res.items as YouTubeDetectedItem[],
        fetchedAt: res.fetchedAt,
        isCollection: res.isCollection,
        isSingleItem: res.isSingleItem,
        provider: 'youtube',
        kindsSummary: res.kindsSummary,
        collectionTitle: (res as any).collectionTitle,
        metadataSource: res.metadataSource,
        warnings: res.warnings,
      };
      setResult(mapped);
      setJobId(res.jobId);
      setPage(1);
      const initial: YouTubeImportDraft[] = mapped.items.map((it) => ({
        detected: it,
        selected: true,
        customTitle: it.title,
        customDescription: it.description ?? '',
        contentType: defaultContentTypeForKind(it.kind),
        scholarIds: [],
        subjectIds: [],
        language: (it.language as string) ?? 'English',
        series: mapped.isCollection ? mapped.title : '',
        category: '',
        status: 'draft' as const,
      }));
      for (const d of initial) {
        const match = scholars.find((s) => d.detected.creator && s.name.toLowerCase().includes(d.detected.creator.split(' ').slice(-1)[0]!.toLowerCase()));
        if (match) d.scholarIds = [match.id];
        if (d.detected.subjectHint) {
          const hint = d.detected.subjectHint.toLowerCase();
          const subjMatch = subjects.find((s) => s.name.toLowerCase().includes(hint) || s.id.toLowerCase() === hint);
          if (subjMatch) d.subjectIds = [subjMatch.id];
        }
      }
      setDrafts(initial);
      setProviderNote(null);
    } catch (e: any) {
      const msg = e.message || String(e);
      setProviderNote(`YouTube fetch failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drafts.filter((d) => {
      const matchesKind = kindFilter === 'all' || d.detected.kind === kindFilter;
      const text = `${d.customTitle} ${d.detected.identifier} ${d.detected.creator ?? ''} ${d.detected.youtubeUrl}`.toLowerCase();
      const matchesQ = !q || text.includes(q);
      return matchesKind && matchesQ;
    });
  }, [drafts, query, kindFilter]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const selectedCount = drafts.filter((d) => d.selected && d.status !== 'skip').length;

  const toggleSelect = (idxGlobal: number) => {
    setDrafts((prev) => {
      const copy = [...prev];
      const targetId = filtered[idxGlobal]!.detected.identifier;
      const realIdx = prev.findIndex((x) => x.detected.identifier === targetId);
      if (realIdx !== -1) {
        copy[realIdx] = { ...copy[realIdx]!, selected: !copy[realIdx]!.selected };
      }
      return copy;
    });
  };

  const updateDraft = (identifier: string, patch: Partial<YouTubeImportDraft>) => {
    setDrafts((prev) => prev.map((d) => (d.detected.identifier === identifier ? { ...d, ...patch } : d)));
  };

  const selectAllFiltered = (on: boolean) => {
    const ids = new Set(filtered.map((f) => f.detected.identifier));
    setDrafts((prev) => prev.map((d) => (ids.has(d.detected.identifier) ? { ...d, selected: on } : d)));
  };

  const applyBulk = () => {
    if (!bulkScholar && !bulkSubject && !bulkLang) return;
    const ids = new Set(filtered.filter((f) => f.selected).map((f) => f.detected.identifier));
    setDrafts((prev) =>
      prev.map((d) => {
        if (!ids.has(d.detected.identifier)) return d;
        const next: YouTubeImportDraft = { ...d };
        if (bulkScholar) next.scholarIds = [bulkScholar];
        if (bulkSubject) {
          if (!next.subjectIds.includes(bulkSubject)) next.subjectIds = [...next.subjectIds, bulkSubject];
        }
        if (bulkLang) next.language = bulkLang;
        return next;
      })
    );
  };

  const handleImport = async () => {
    const selected = drafts.filter((d) => d.selected && d.status !== 'skip');
    if (selected.length === 0) {
      setProviderNote('Select at least one item to import.');
      return;
    }
    if (!jobId) {
      setProviderNote('No YouTube job to confirm — preview first.');
      return;
    }
    setImporting(true);
    try {
      const res = await confirmYouTube(jobId, drafts);
      const { created, duplicates, errors } = res.summary;
      await refresh();
      if (errors > 0) {
        flash(`Import done: ${created} created, ${duplicates} duplicates, ${errors} errors.`);
      } else if (duplicates > 0) {
        flash(`Imported ${created} new records — ${duplicates} already existed and were skipped.`);
      } else {
        flash(`Successfully imported ${created} YouTube videos as separate records.`);
      }
      if (res.results.some((r) => r.status === 'duplicate')) {
        const dupIds = res.results.filter((r) => r.status === 'duplicate').map((r) => r.identifier).slice(0, 5).join(', ');
        setProviderNote(`Duplicates skipped: ${dupIds}${res.results.filter((r) => r.status === 'duplicate').length > 5 ? ' …' : ''}. Each duplicate is provider+youtube externalIdentifier already in DB.`);
      } else {
        setProviderNote(null);
      }
      if (created > 0) navigate('/admin');
    } catch (e: any) {
      setProviderNote(`Import failed: ${e.message || String(e)}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1160px] space-y-8">
      <Link to="/admin" className="text-ink-muted hover:text-rose text-[0.86rem] font-semibold">
        ← Overview
      </Link>
      <PageIntro
        eyebrow="YouTube — import single or playlist"
        title="YouTube bulk import"
        intro="Paste any YouTube link — a single video (watch, youtu.be, shorts, embed) or a playlist (playlist?list=… or watch?v=…&list=…). ilmNet fetches the metadata, shows each video as its own draft, and on confirm creates a separate record per video with the same collectionIdentifier = playlistId."
        action={<PrimaryButton onClick={handleDetect} disabled={loading}>{loading ? 'Analysing…' : 'Analyse URL'}</PrimaryButton>}
      />

      <section className="bg-sand neu-raised rounded-[28px] p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex-1">
            <Field label="YouTube URL" required hint="Supports youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, youtube.com/embed/, and youtube.com/playlist?list= for collections">
              <TextInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." inputMode="url" />
            </Field>
            {providerNote && <p className={`mt-3 text-[0.82rem] font-medium ${providerNote.includes('failed') || providerNote.includes('Duplicates') ? 'text-rose' : 'text-olive-deep'}`}>{providerNote}</p>}
            {loading && <p className="text-ink-muted mt-3 text-[0.82rem]">Fetching YouTube metadata — official Data API when the server has YOUTUBE_API_KEY, otherwise the public watch/playlist pages (max 100, dedup), 7s timeout per request…</p>}
          </div>
          <div className="flex flex-col gap-3 sm:ml-6 sm:w-[220px]">
            <div className="bg-cream neu-inset rounded-[16px] px-4 py-3 text-[0.72rem] leading-relaxed text-ink-soft">
              <span className="font-semibold text-ink">YouTube live fetch</span> — runs without a key (oEmbed + <span className="font-mono text-[0.68rem]">ytInitialPlayerResponse</span>; playlists from the public page, max 100). With <span className="font-mono text-[0.68rem]">YOUTUBE_API_KEY</span> in the <em>server</em> environment the official Data API is used first: exact durations, publish dates and whether the video is embeddable. The key stays server-side — never in this bundle.
            </div>
            <PrimaryButton onClick={handleDetect} disabled={loading}>{loading ? 'Analysing…' : 'Analyse & detect'}</PrimaryButton>
            <p className="text-ink-muted text-[0.72rem] leading-relaxed">Embed preview: single <span className="font-mono text-[0.7rem]">/embed/&lt;videoId&gt;</span> · playlist itself <span className="font-mono text-[0.7rem]">videoseries?list=</span> but each playlist item embeds as its own <span className="font-mono text-[0.7rem]">/embed/&lt;videoId&gt;</span>.</p>
            {jobId && <p className="text-ink-muted text-[0.68rem] font-mono break-all">jobId: {jobId}</p>}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="bg-cream neu-raised-sm rounded-[18px] p-4 ring-1 ring-rose/20">
            <p className="text-ink-muted text-[0.68rem] font-semibold tracking-[0.14em] uppercase">Source provider</p>
            <p className="font-display text-ink mt-1 text-[0.95rem] font-bold">YouTube <span className="text-rose font-normal">· video/playlist</span></p>
            <p className="text-ink-soft mt-1 text-[0.78rem]">This page is for YouTube — single or playlist as collection.</p>
          </div>
          <div className="bg-cream neu-raised-sm rounded-[18px] p-4">
            <p className="text-ink-muted text-[0.68rem] font-semibold tracking-[0.14em] uppercase">Source provider</p>
            <p className="font-display text-ink mt-1 text-[0.95rem] font-bold">Archive.org <span className="text-ink-muted font-normal">· generic</span></p>
            <p className="text-ink-soft mt-1 text-[0.78rem]">Separate page — audio, video, books, documents, collections.</p>
          </div>
          <div className="bg-cream neu-raised-sm rounded-[18px] p-4">
            <p className="text-ink-muted text-[0.68rem] font-semibold tracking-[0.14em] uppercase">Playlist handling</p>
            <p className="font-display text-ink mt-1 text-[0.95rem] font-bold">100 max per preview</p>
            <p className="text-ink-soft mt-1 text-[0.78rem]">Deduped, selectable, each → own Content with collectionIdentifier=playlistId.</p>
          </div>
        </div>
      </section>

      {!result ? (
        <div className="bg-cream neu-inset rounded-[28px] px-6 py-14 text-center">
          <p className="font-display text-ink text-[1.2rem] font-extrabold">Paste a link and analyse</p>
          <p className="text-ink-muted mx-auto mt-2 max-w-[520px] text-[0.92rem] leading-relaxed">ilmNet will fetch the YouTube metadata (title, description, thumbnail, channel, duration, publish date) and list each video. Pick which to import; each becomes a separate record with its own embed.</p>
          <div className="mx-auto mt-6 max-w-[560px] rounded-[18px] bg-sand p-4 text-left">
            <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.12em] uppercase">What you’ll see after detection</p>
            <p className="font-display text-ink mt-2 text-[1.05rem] font-bold">“YouTube playlist detected — 100 items found”</p>
            <p className="text-ink-soft mt-1 text-[0.82rem]">Then a selectable overview where each video can be individually edited: title, content type, scholar, subject, language, series, draft/publish/skip. Individual videos from a playlist keep individual embeds.</p>
          </div>
        </div>
      ) : (
        <>
          <section className="neu-raised overflow-hidden rounded-[28px] bg-cream">
            <div className="bg-rose px-6 py-5 sm:px-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-cream/80 text-[0.72rem] font-semibold tracking-[0.18em] uppercase">YouTube detected</p>
                  <h2 className="font-display text-cream mt-1 text-[1.45rem] font-extrabold tracking-tight">
                    {result.isSingleItem ? 'YouTube video detected' : `YouTube playlist detected — ${result.totalItems} videos found`}
                  </h2>
                  <p className="text-cream/85 mt-1 text-[0.88rem]">{result.title} · <span className="font-mono text-[0.78rem]">{result.identifier}</span></p>
                </div>
                <div className="flex gap-2">
                  <span className="bg-cream text-ink rounded-full px-4 py-2 text-[0.82rem] font-semibold">{result.isSingleItem ? 'Single video' : 'Playlist collection'}</span>
                  <span className="bg-black/15 text-cream rounded-full px-4 py-2 text-[0.82rem] font-semibold">{Object.entries(result.kindsSummary).map(([k, v]) => `${v} ${k}`).join(' · ')}</span>
                </div>
              </div>
              {result.description && <p className="text-cream/85 mt-3 max-w-[720px] text-[0.88rem] leading-relaxed line-clamp-3">{result.description}</p>}
            </div>
            <div className="px-6 py-4 sm:px-8 bg-sand/50 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-ink-muted text-[0.82rem]">
                Source: <a href={result.sourceUrl} target="_blank" rel="noreferrer" className="text-ink font-medium underline decoration-line/40 break-all">{result.sourceUrl}</a> · Fetched {result.fetchedAt} ·{' '}
                {result.metadataSource === 'api'
                  ? 'metadata via the official YouTube Data API (server-side key)'
                  : 'metadata read from the public YouTube pages'}
              </p>
              {Boolean(result.warnings?.length) && (
                <p className="text-rose text-[0.8rem] font-medium">
                  {result.warnings!.map((w) => <span key={w} className="block">⚠ {w}</span>)}
                </p>
              )}
              <p className="text-ink-muted text-[0.72rem]">Each selected video will become its <span className="font-semibold text-ink-soft">own</span> ilmNet record.</p>
            </div>
          </section>

          <section className="bg-sand neu-raised rounded-[28px] p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => selectAllFiltered(true)} className="bg-cream neu-raised-sm rounded-full px-4 py-2 text-[0.82rem] font-semibold">Select all ({filtered.length})</button>
                  <button type="button" onClick={() => selectAllFiltered(false)} className="bg-cream neu-raised-sm rounded-full px-4 py-2 text-[0.82rem] font-semibold">Deselect filtered</button>
                  <span className="bg-cream neu-inset rounded-full px-4 py-2 text-[0.82rem] font-medium text-ink-muted">{selectedCount} selected for import · {drafts.length} total detected</span>
                </div>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <TextInput value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search title, videoId, channel…" />
                  </div>
                  <select value={kindFilter} onChange={(e) => { setKindFilter(e.target.value); setPage(1); }} className="bg-cream neu-inset rounded-[16px] px-4 py-3 text-[0.9rem] outline-none">
                    <option value="all">All types</option>
                    <option value="video">Video</option>
                  </select>
                </div>
              </div>
              <div className="bg-cream neu-raised-sm rounded-[20px] p-4 lg:w-[360px]">
                <p className="text-ink-muted text-[0.68rem] font-semibold tracking-[0.14em] uppercase">Bulk assign for selected filtered items</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-1">
                  <Field label="Set scholar for selected">
                    <SelectInput value={bulkScholar} onChange={(e) => setBulkScholar(e.target.value)}>
                      <option value="">— keep individual —</option>
                      {scholars.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label="Add subject to selected">
                    <SelectInput value={bulkSubject} onChange={(e) => setBulkSubject(e.target.value)}>
                      <option value="">— choose —</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label="Set language">
                    <SelectInput value={bulkLang} onChange={(e) => setBulkLang(e.target.value)}>
                      <option value="">— keep —</option>
                      <option>English</option>
                      <option>Arabic</option>
                      <option>English / Arabic</option>
                      <option>Urdu</option>
                    </SelectInput>
                  </Field>
                  <button type="button" onClick={applyBulk} className="bg-rose text-cream rounded-[14px] px-4 py-2.5 text-[0.86rem] font-semibold">Apply to {filtered.filter((f) => f.selected).length} selected</button>
                </div>
              </div>
            </div>
            {totalPages > 1 && (
              <div className="mt-5 flex items-center justify-between">
                <p className="text-ink-muted text-[0.78rem]">Page {page} of {totalPages} · {filtered.length} items after filters</p>
                <div className="flex gap-2">
                  <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="bg-cream neu-raised-sm rounded-full px-4 py-2 text-[0.82rem] font-semibold disabled:opacity-40">Prev</button>
                  <button disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="bg-cream neu-raised-sm rounded-full px-4 py-2 text-[0.82rem] font-semibold disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4">
            {paged.length === 0 ? (
              <div className="bg-cream neu-inset rounded-[24px] px-6 py-14 text-center">
                <p className="font-display text-ink text-[1.1rem] font-bold">No items match filters</p>
                <p className="text-ink-muted mt-2 text-[0.88rem]">Try clearing search or type filter.</p>
              </div>
            ) : (
              paged.map((d, i) => {
                const globalIdx = (page - 1) * pageSize + i;
                const realDraft = filtered[globalIdx]!;
                const identifier = realDraft.detected.identifier;
                return (
                  <article key={identifier} className={`bg-cream neu-raised rounded-[24px] p-5 sm:p-6 ${d.selected ? 'ring-1 ring-rose/20' : 'opacity-85'}`}>
                    <div className="flex gap-4">
                      <label className="flex h-6 w-6 shrink-0 items-center justify-center pt-1">
                        <input type="checkbox" checked={d.selected} onChange={() => toggleSelect(globalIdx)} className="h-5 w-5 accent-rose" />
                      </label>
                      <div className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[14px] bg-sand neu-inset">
                        {d.detected.thumbnail ? (
                          <img src={d.detected.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
                        ) : (
                          <span className="grid h-full w-full place-items-center text-ink-muted text-[0.62rem] font-bold">NO COVER</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold tracking-[0.04em] uppercase ${kindBadge(d.detected.kind)}`}>{d.detected.kind}</span>
                          <span className="bg-sand text-ink-soft rounded-full px-2.5 py-1 text-[0.68rem] font-semibold">{d.detected.mediaTypes.join(' · ') || 'YouTube Video'}</span>
                          {d.detected.duration && <span className="bg-cream neu-inset rounded-full px-2.5 py-1 text-[0.68rem] font-medium text-ink-muted">{d.detected.duration}</span>}
                        </div>
                        <div className="mt-2">
                          <TextInput value={d.customTitle} onChange={(e) => updateDraft(identifier, { customTitle: e.target.value })} placeholder="Title" className="font-semibold" />
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-2 text-[0.72rem]">
                          <a href={d.detected.youtubeUrl} target="_blank" rel="noreferrer" className="text-ink-muted hover:text-rose font-mono break-all">{d.detected.youtubeUrl}</a>
                          <span className="text-ink-muted">· id: <span className="font-mono text-ink">{d.detected.identifier}</span></span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[0.72rem]">
                          {d.detected.creator && <span className="bg-sand rounded-full px-2.5 py-1 font-medium text-ink-soft">Channel: {d.detected.creator}</span>}
                          {d.detected.date && <span className="bg-sand rounded-full px-2.5 py-1 text-ink-muted">{d.detected.date}</span>}
                          {d.detected.collection && <span className="bg-cream neu-inset rounded-full px-2.5 py-1 text-ink-muted">playlist: {d.detected.collection}</span>}
                        </div>
                        {d.detected.description && (
                          <p className="text-ink-soft mt-2 line-clamp-2 text-[0.82rem] leading-relaxed">{d.detected.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 rounded-[18px] bg-sand neu-inset p-4 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Content type" hint="Maps to ilmNet record">
                        <SelectInput value={d.contentType} onChange={(e) => updateDraft(identifier, { contentType: e.target.value as ArchiveContentType })}>
                          <option value="lecture">Lecture</option>
                          <option value="audio">Audio</option>
                          <option value="video">Video</option>
                          <option value="book">Book</option>
                          <option value="document">Document</option>
                        </SelectInput>
                      </Field>
                      <Field label="Scholar / speaker">
                        <SelectInput
                          value={d.scholarIds[0] ?? ''}
                          onChange={(e) => updateDraft(identifier, { scholarIds: e.target.value ? [e.target.value] : [] })}
                        >
                          <option value="">— unassigned —</option>
                          {scholars.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </SelectInput>
                        {d.scholarIds.length === 0 && <p className="text-rose mt-1 text-[0.72rem]">Required for publish — pick a scholar</p>}
                      </Field>
                      <Field label="Status">
                        <SelectInput value={d.status} onChange={(e) => updateDraft(identifier, { status: e.target.value as any })}>
                          <option value="draft">Save as draft</option>
                          <option value="published">Publish</option>
                          <option value="skip">Skip — do not import</option>
                        </SelectInput>
                      </Field>

                      <Field label="Subject(s)">
                        <div className="flex flex-wrap gap-1.5 rounded-[16px] bg-cream p-2 neu-inset max-h-[86px] overflow-auto">
                          {subjects.map((s) => {
                            const on = d.subjectIds.includes(s.id);
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  const next = on ? d.subjectIds.filter((x) => x !== s.id) : [...d.subjectIds, s.id];
                                  updateDraft(identifier, { subjectIds: next });
                                }}
                                className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${on ? 'bg-rose text-cream' : 'bg-sand text-ink-soft'}`}
                              >
                                {s.name}
                              </button>
                            );
                          })}
                        </div>
                        {d.subjectIds.length === 0 && <p className="text-rose mt-1 text-[0.72rem]">At least one subject required for publish</p>}
                      </Field>

                      <Field label="Language">
                        <SelectInput value={d.language} onChange={(e) => updateDraft(identifier, { language: e.target.value })}>
                          <option>English</option>
                          <option>Arabic</option>
                          <option>English / Arabic</option>
                          <option>Urdu</option>
                          <option>French</option>
                        </SelectInput>
                      </Field>

                      <Field label="Series / collection">
                        <TextInput value={d.series} onChange={(e) => updateDraft(identifier, { series: e.target.value })} placeholder="e.g. YouTube Series" />
                      </Field>

                      <div className="sm:col-span-2 lg:col-span-3">
                        <Field label="Description — editable" hint="Prefilled from YouTube description">
                          <TextArea value={d.customDescription} onChange={(e) => updateDraft(identifier, { customDescription: e.target.value })} placeholder="Description" className="min-h-[84px]" />
                        </Field>
                      </div>

                      <Field label="Category">
                        <SelectInput value={d.category} onChange={(e) => updateDraft(identifier, { category: e.target.value })}>
                          <option value="">—</option>
                          <option value="Translation">Translation</option>
                          <option value="Commentary">Commentary</option>
                          <option value="Primer">Primer</option>
                          <option value="Classical">Classical</option>
                          <option value="Audio">Audio</option>
                          <option value="Video">Video</option>
                        </SelectInput>
                      </Field>

                      <div className="sm:col-span-2 flex items-center gap-2 pt-2">
                        <button type="button" onClick={() => updateDraft(identifier, { selected: !d.selected })} className={`rounded-full px-4 py-2 text-[0.82rem] font-semibold ${d.selected ? 'bg-rose text-cream' : 'bg-cream neu-raised-sm text-ink'}`}>
                          {d.selected ? 'Selected for import' : 'Deselected'}
                        </button>
                        <a href={d.detected.embedUrl} target="_blank" rel="noreferrer" className="text-ink-muted hover:text-rose text-[0.82rem] font-medium">Preview embed ↗</a>
                        <span className="text-ink-muted hidden text-[0.72rem] sm:inline">Each = 1 record, embed = {d.detected.embedUrl}</span>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </section>

          <section className="sticky bottom-4 z-30 mt-8 flex flex-col gap-3 rounded-[24px] bg-night neu-dark-raised p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-cream font-semibold">{selectedCount} videos selected</p>
              <p className="text-cream/70 text-[0.82rem]">Each will be saved as an individual record — {result.totalItems} found, {selectedCount} will be created. Playlist items share collectionIdentifier = {result.identifier}</p>
            </div>
            <div className="flex gap-3">
              <GhostButton onClick={() => { setResult(null); setJobId(null); }}>Cancel</GhostButton>
              <button
                onClick={handleImport}
                className="bg-rose text-cream rounded-[18px] px-6 py-3 text-[0.94rem] font-semibold shadow-[8px_10px_22px_rgba(204,58,99,0.32)] disabled:opacity-50"
                disabled={selectedCount === 0 || importing}
              >
                {importing ? 'Importing…' : `Import ${selectedCount} as separate records`}
              </button>
            </div>
          </section>

          <ErrorBanner message={null} />
        </>
      )}
    </div>
  );
}
