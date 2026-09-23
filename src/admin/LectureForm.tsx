import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  getArchiveEmbedUrl,
  getYoutubeEmbedUrl,
  isArchiveUrl,
  isYoutubePlaylistUrl,
  isYoutubeUrl,
  lectureFormats,
  lectureLevels,
  lectureProviderOptions,
  lectureSourceOptions,
  todayStamp,
  uid,
  type AdminLecture,
  type LectureFormat,
  type LectureLevel,
  type LectureSourceType,
  type PublishStatus,
  type SourceProvider,
} from './data';
import { useAdmin } from './store';
import {
  ArchiveEmbed,
  ChipToggle,
  CoverPreview,
  ErrorBanner,
  Field,
  GhostButton,
  PageIntro,
  PrimaryButton,
  SelectInput,
  SourceCard,
  TextArea,
  TextInput,
  YoutubeEmbed,
} from './ui';

const empty: Omit<AdminLecture, 'id' | 'updatedAt'> = {
  title: '',
  youtubeUrl: '',
  sourceType: 'youtube-video',
  provider: 'youtube',
  sourceUrl: '',
  scholarId: '',
  scholarIds: [],
  subjectIds: [],
  description: '',
  series: '',
  format: 'Video',
  level: 'Beginner',
  durationMin: 30,
  episodes: 1,
  status: 'draft',
  thumbnailUrl: '',
  language: 'English',
  tags: [],
};

export default function LectureForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lectures, scholars, subjects, upsertLecture } = useAdmin();
  const existing = id ? lectures.find((l) => l.id === id) : undefined;
  const isNew = !id;

  const [form, setForm] = useState<Omit<AdminLecture, 'id' | 'updatedAt'>>(() => {
    if (existing) {
      const prov: SourceProvider = (existing as any).provider ?? (existing.youtubeUrl && isYoutubeUrl(existing.youtubeUrl) ? 'youtube' : existing.sourceUrl && isArchiveUrl(existing.sourceUrl) ? 'archive' : 'youtube');
      return {
        title: existing.title,
        youtubeUrl: existing.youtubeUrl,
        sourceType: existing.sourceType ?? (isYoutubePlaylistUrl(existing.youtubeUrl) ? 'youtube-playlist' : 'youtube-video'),
        provider: prov,
        sourceUrl: (existing as any).sourceUrl ?? existing.youtubeUrl,
        archiveIdentifier: (existing as any).archiveIdentifier,
        mediaTypes: (existing as any).mediaTypes,
        scholarId: existing.scholarId,
        scholarIds: existing.scholarIds ?? (existing.scholarId ? [existing.scholarId] : []),
        subjectIds: existing.subjectIds,
        description: existing.description,
        series: existing.series,
        format: existing.format,
        level: existing.level,
        durationMin: existing.durationMin,
        episodes: existing.episodes,
        status: existing.status,
        thumbnailUrl: existing.thumbnailUrl ?? '',
        language: existing.language ?? 'English',
        tags: existing.tags ?? [],
      };
    }
    return empty;
  });
  const [error, setError] = useState<string | null>(null);

  if (id && !existing) {
    return (
      <div className="mx-auto max-w-[720px]">
        <PageIntro eyebrow="Lectures" title="Not found" intro="This lecture is no longer on the desk." />
        <div className="mt-8">
          <GhostButton to="/admin/lectures">Back to lectures</GhostButton>
        </div>
      </div>
    );
  }

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleSubject = (sid: string) =>
    setForm((f) => ({
      ...f,
      subjectIds: f.subjectIds.includes(sid) ? f.subjectIds.filter((x) => x !== sid) : [...f.subjectIds, sid],
    }));

  const toggleScholar = (sid: string) =>
    setForm((f) => {
      const cur = f.scholarIds ?? [];
      const next = cur.includes(sid) ? cur.filter((x) => x !== sid) : [...cur, sid];
      return { ...f, scholarIds: next, scholarId: next[0] ?? '' };
    });

  const provider = (form.provider as SourceProvider) ?? 'youtube';
  const isArchiveProvider = provider === 'archive';
  const ytEmbedUrl = useMemo(() => getYoutubeEmbedUrl(form.youtubeUrl), [form.youtubeUrl]);
  const archiveUrl = (form.sourceUrl as string) || '';
  const archiveEmbedOk = isArchiveProvider ? Boolean(getArchiveEmbedUrl(archiveUrl)) : false;
  const urlOk = isArchiveProvider ? isArchiveUrl(archiveUrl) : isYoutubeUrl(form.youtubeUrl);
  const isPlaylist = form.sourceType === 'youtube-playlist' || (form.sourceType === undefined && isYoutubePlaylistUrl(form.youtubeUrl));

  const save = (status: PublishStatus) => {
    const scholarsChosen = form.scholarIds && form.scholarIds.length > 0 ? form.scholarIds : form.scholarId ? [form.scholarId] : [];
    if (!form.title.trim() || scholarsChosen.length === 0 || form.subjectIds.length === 0) {
      setError('Title, at least one scholar and one subject are required.');
      return;
    }
    if (!isArchiveProvider && !form.youtubeUrl.trim()) {
      setError('YouTube URL is required for YouTube lectures.');
      return;
    }
    if (isArchiveProvider && !archiveUrl.trim()) {
      setError('Archive.org URL is required for Archive lectures.');
      return;
    }
    if (!isArchiveProvider && !isYoutubeUrl(form.youtubeUrl.trim())) {
      setError('Enter a valid YouTube URL — single video (youtube.com/watch?v=… or youtu.be/…) or a full playlist (…/playlist?list=…).');
      return;
    }
    if (isArchiveProvider && !isArchiveUrl(archiveUrl.trim())) {
      setError('Enter a valid Archive.org URL — e.g. https://archive.org/details/<identifier>');
      return;
    }
    const item: AdminLecture = {
      id: existing?.id ?? uid('l'),
      ...form,
      title: form.title.trim(),
      youtubeUrl: isArchiveProvider ? '' : form.youtubeUrl.trim(),
      sourceUrl: isArchiveProvider ? archiveUrl.trim() : form.youtubeUrl.trim(),
      provider: provider,
      scholarId: scholarsChosen[0]!,
      scholarIds: scholarsChosen,
      description: form.description.trim(),
      series: form.series.trim(),
      thumbnailUrl: form.thumbnailUrl?.trim(),
      status,
      updatedAt: todayStamp(),
    } as AdminLecture;
    upsertLecture(item, existing ? 'Updated' : 'Added');
    navigate('/admin/lectures');
  };

  return (
    <div className="mx-auto max-w-[760px]">
      <Link to="/admin/lectures" className="text-ink-muted hover:text-rose text-[0.86rem] font-semibold">
        ← Lectures
      </Link>
      <div className="mt-5">
        <PageIntro
          eyebrow={isNew ? 'New lecture — externally hosted' : 'Edit lecture'}
          title={isNew ? 'Add a lecture' : existing!.title}
          intro={
            isArchiveProvider
              ? 'Archive.org lectures: audio, video or mixed — paste the Archive.org link, preview the embed, then add scholar(s) and subject(s). For many items use Bulk import.'
              : 'YouTube lectures: single video or full playlist — paste the YouTube link, preview the embed, then add scholar(s) and subject(s).'
          }
        />
      </div>

      <form
        className="mt-10 space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          save(form.status);
        }}
      >
        <ErrorBanner message={error} />

        {/* Provider selector — new generic layer */}
        <section className="bg-sand neu-raised rounded-[28px] p-6 sm:p-8">
          <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.2em] uppercase">Source provider</p>
          <p className="text-ink-soft mt-1 text-[0.86rem]">Choose where this lecture is hosted. Archive.org is now generic — not only for books.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {lectureProviderOptions.map((opt) => (
              <SourceCard
                key={opt.value}
                active={provider === opt.value}
                title={opt.label}
                hint={opt.hint}
                onClick={() => set('provider' as any, opt.value as any)}
                icon={
                  opt.value === 'youtube' ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M8 5.6c0-.9 1-1.5 1.8-1l8.1 5.1a1.2 1.2 0 0 1 0 2L9.8 17c-.8.5-1.8-.1-1.8-1V5.6Z" /></svg>
                  ) : opt.value === 'archive' ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 19V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v13" /><path d="M14 19V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                  )
                }
              />
            ))}
          </div>
          {isArchiveProvider && (
            <div className="mt-4 rounded-[16px] bg-cream neu-inset px-4 py-3 text-[0.82rem] text-ink-soft">
              For a single Archive.org audio/video use this form. For a collection with many items (e.g. 100 lectures) use <Link to="/admin/archive-import" className="text-rose font-semibold underline decoration-rose/30">Bulk Archive import</Link> — it detects every item and lets you configure each one separately.
            </div>
          )}
        </section>

        {/* Source + URL */}
        <section className="bg-sand neu-raised rounded-[28px] p-6 sm:p-8">
          {!isArchiveProvider ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.2em] uppercase">External source — YouTube</p>
                <span className="text-ink-muted text-[0.72rem]">{form.sourceType === 'youtube-playlist' ? 'Playlist' : 'Single video'}</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {lectureSourceOptions.map((opt) => (
                  <SourceCard
                    key={opt.value}
                    active={form.sourceType === opt.value}
                    title={opt.label}
                    hint={opt.hint}
                    onClick={() => set('sourceType', opt.value as LectureSourceType)}
                    icon={
                      opt.value === 'youtube-playlist' ? (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M8 5.6c0-.9 1-1.5 1.8-1l8.1 5.1a1.2 1.2 0 0 1 0 2L9.8 17c-.8.5-1.8-.1-1.8-1V5.6Z" /></svg>
                      )
                    }
                  />
                ))}
              </div>

              <div className="mt-6">
                <Field
                  label={form.sourceType === 'youtube-playlist' ? 'YouTube playlist URL' : 'YouTube video URL'}
                  required
                  hint={
                    form.sourceType === 'youtube-playlist'
                      ? 'Example: https://www.youtube.com/playlist?list=PL…  or  https://www.youtube.com/watch?v=…&list=PL…'
                      : 'Supports watch?v=, youtu.be/, shorts/ and embed links. The video stays on YouTube.'
                  }
                >
                  <TextInput
                    value={form.youtubeUrl}
                    onChange={(e) => set('youtubeUrl', e.target.value)}
                    placeholder={form.sourceType === 'youtube-playlist' ? 'https://www.youtube.com/playlist?list=…' : 'https://www.youtube.com/watch?v=…'}
                    inputMode="url"
                  />
                  {form.youtubeUrl.trim() && (
                    <div className={`mt-3 flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.78rem] font-medium ${urlOk ? 'bg-olive/15 text-olive-deep' : 'bg-rose/10 text-rose'}`}>
                      <span className={`h-2 w-2 rounded-full ${urlOk ? 'bg-olive' : 'bg-rose'}`} />
                      {urlOk ? (isPlaylist ? 'Playlist link recognised — will embed as videoseries' : 'YouTube link recognised') : 'This does not look like a YouTube URL'}
                    </div>
                  )}
                </Field>

                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => set('youtubeUrl', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')} className="bg-cream neu-raised-sm rounded-full px-3 py-1.5 text-[0.78rem] font-medium">Video example</button>
                  <button type="button" onClick={() => set('youtubeUrl', 'https://www.youtube.com/playlist?list=PLQ5aNFhB5PJ6p9F0Y8jX8x8x8x8x8x8x8x8x')} className="bg-cream neu-raised-sm rounded-full px-3 py-1.5 text-[0.78rem] font-medium">Playlist example</button>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.2em] uppercase">External source — Archive.org (generic)</p>
              <p className="text-ink-soft mt-1 text-[0.86rem]">Audio, video, or mixed content. One Archive.org identifier per lecture record — for collections use bulk import.</p>
              <div className="mt-5">
                <Field label="Archive.org URL" required hint="Example: https://archive.org/details/<identifier> — stays externally hosted, we embed the player.">
                  <TextInput value={archiveUrl} onChange={(e) => set('sourceUrl' as any, e.target.value as any)} placeholder="https://archive.org/details/…" inputMode="url" />
                  {archiveUrl.trim() && (
                    <div className={`mt-3 flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.78rem] font-medium ${urlOk ? 'bg-olive/15 text-olive-deep' : 'bg-rose/10 text-rose'}`}>
                      <span className={`h-2 w-2 rounded-full ${urlOk ? 'bg-olive' : 'bg-rose'}`} />
                      {urlOk ? 'Archive.org URL recognised' : 'Not an Archive.org URL'}
                    </div>
                  )}
                </Field>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => set('sourceUrl' as any, 'https://archive.org/details/ilmnet-jumuah-reflection-042' as any)} className="bg-cream neu-raised-sm rounded-full px-3 py-1.5 text-[0.78rem] font-medium">Audio example</button>
                  <button type="button" onClick={() => set('sourceUrl' as any, 'https://archive.org/details/ilmnet-usul-class07' as any)} className="bg-cream neu-raised-sm rounded-full px-3 py-1.5 text-[0.78rem] font-medium">Video example</button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Preview embedded content */}
        <section className="bg-cream neu-raised rounded-[28px] p-6 sm:p-8">
          <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.2em] uppercase">Preview embedded content</p>
          <p className="text-ink-soft mt-2 text-[0.86rem]">If it plays here, it will play on the public page. External hosting stays intact.</p>
          <div className="mt-5">
            {!isArchiveProvider ? (
              form.youtubeUrl.trim() ? (
                ytEmbedUrl ? (
                  <YoutubeEmbed url={form.youtubeUrl} />
                ) : (
                  <div className="bg-rose/10 text-rose rounded-[20px] px-6 py-8 text-center text-[0.9rem]">Could not build an embed from this URL — check the video/playlist ID.</div>
                )
              ) : (
                <div className="bg-sand neu-inset rounded-[20px] px-6 py-10 text-center">
                  <p className="text-ink-muted text-[0.9rem]">Paste a YouTube URL above to see the player.</p>
                </div>
              )
            ) : archiveUrl.trim() ? (
              archiveEmbedOk ? (
                <ArchiveEmbed url={archiveUrl} />
              ) : (
                <div className="bg-rose/10 text-rose rounded-[20px] px-6 py-8 text-center text-[0.9rem]">Enter a valid Archive.org details URL — e.g. https://archive.org/details/…</div>
              )
            ) : (
              <div className="bg-sand neu-inset rounded-[20px] px-6 py-10 text-center">
                <p className="text-ink-muted text-[0.9rem]">Paste an Archive.org URL above to see the player / reader.</p>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-5">
          <Field label="Title" required>
            <TextInput value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Opening the Qurʾān: Sūrat al-Fātiḥah" />
          </Field>
          <Field label="Short description" hint="One or two sentences for the public library card.">
            <TextArea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What this series covers, in plain language."
            />
          </Field>
          <Field label="Thumbnail / cover URL" hint="Optional. Auto-falls back to provider thumbnail when empty.">
            <TextInput value={form.thumbnailUrl ?? ''} onChange={(e) => set('thumbnailUrl', e.target.value)} placeholder="https://…/cover.jpg" inputMode="url" />
            <CoverPreview url={form.thumbnailUrl ?? ''} title={form.title || 'Lecture'} />
            {!form.thumbnailUrl?.trim() && !isArchiveProvider && ytEmbedUrl && !ytEmbedUrl.includes('videoseries') && (
              <p className="text-ink-muted mt-2 text-[0.72rem]">Auto thumbnail: <span className="font-mono break-all text-[0.7rem]">{(() => { const m = ytEmbedUrl.match(/\/embed\/([^?]+)/); return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : ''; })()}</span></p>
            )}
          </Field>
        </section>

        <section className="bg-cream neu-raised space-y-6 rounded-[28px] p-6 sm:p-8">
          <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.2em] uppercase">Scholars & subjects</p>
          <Field label="Scholar(s)" required hint="A lecture can have multiple teachers. Pick at least one.">
            <div className="flex flex-wrap gap-2">
              {scholars.map((s) => {
                const on = (form.scholarIds ?? []).includes(s.id) || form.scholarId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleScholar(s.id)}
                    className={`flex items-center gap-2 rounded-full px-3 py-2 text-[0.84rem] font-semibold ${on ? 'bg-rose text-cream shadow-[6px_8px_14px_rgba(204,58,99,0.26)]' : 'bg-cream neu-raised-sm text-ink hover:-translate-y-0.5'}`}
                  >
                    <span className={`grid h-6 w-6 place-items-center rounded-full text-[0.7rem] font-bold ${on ? 'bg-white/20 text-cream' : s.accent === 'rose' ? 'bg-rose/15 text-rose' : 'bg-olive/20 text-olive-deep'}`}>{s.initials}</span>
                    {s.name}
                  </button>
                );
              })}
            </div>
            {(form.scholarIds?.length ?? 0) === 0 && !form.scholarId && <p className="text-ink-muted mt-2 text-[0.78rem]">No scholar selected yet.</p>}
          </Field>
          <Field label="Subjects" required hint="A lecture can belong to more than one shelf.">
            <ChipToggle
              options={subjects.map((s) => ({ value: s.id, label: s.name }))}
              selected={form.subjectIds}
              onToggle={toggleSubject}
            />
          </Field>
        </section>

        <section className="grid gap-5 sm:grid-cols-2">
          <Field label="Series">
            <TextInput value={form.series} onChange={(e) => set('series', e.target.value)} placeholder="Tafsīr Foundations" />
          </Field>
          <Field label="Format">
            <SelectInput value={form.format} onChange={(e) => set('format', e.target.value as LectureFormat)}>
              {lectureFormats.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Level">
            <SelectInput value={form.level} onChange={(e) => set('level', e.target.value as LectureLevel)}>
              {lectureLevels.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Language">
            <SelectInput value={form.language ?? 'English'} onChange={(e) => set('language', e.target.value)}>
              <option>English</option>
              <option>Arabic</option>
              <option>English / Arabic</option>
              <option>Urdu</option>
              <option>French</option>
            </SelectInput>
          </Field>
          <Field label="Minutes per episode">
            <TextInput
              type="number"
              min={1}
              value={form.durationMin}
              onChange={(e) => set('durationMin', Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Episodes">
            <TextInput
              type="number"
              min={1}
              value={form.episodes}
              onChange={(e) => set('episodes', Number(e.target.value) || 1)}
            />
          </Field>
        </section>

        <div className="border-line/80 flex flex-col gap-3 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
          <GhostButton to="/admin/lectures">Cancel</GhostButton>
          <div className="flex flex-col gap-3 sm:flex-row">
            <GhostButton onClick={() => save('draft')}>Save as draft</GhostButton>
            <PrimaryButton onClick={() => save('published')}>Publish to library</PrimaryButton>
          </div>
        </div>
      </form>
    </div>
  );
}
