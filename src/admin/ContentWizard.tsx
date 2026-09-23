import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  bookFormats,
  bookSourceOptions,
  lectureFormats,
  lectureLevels,
  lectureSourceOptions,
  todayStamp,
  uid,
  getYoutubeEmbedUrl,
  getArchiveEmbedUrl,
  getBookEmbedUrl,
  isArchiveUrl,
  isYoutubeUrl,
  type AdminBook,
  type AdminLecture,
  type BookFormat,
  type BookSourceType,
  type LectureFormat,
  type LectureLevel,
  type LectureSourceType,
  type PublishStatus,
} from './data';
import { useAdmin } from './store';
import MediaField from './MediaField';
import {
  ArchiveEmbed,
  ChipToggle,
  ErrorBanner,
  ExternalEmbed,
  Field,
  GhostButton,
  PrimaryButton,
  SelectInput,
  SourceCard,
  TextArea,
  TextInput,
  WorkflowStepper,
  YoutubeEmbed,
} from './ui';

type ContentKind = 'lecture' | 'book';

export default function ContentWizard() {
  const navigate = useNavigate();
  const { scholars, subjects, upsertLecture, upsertBook } = useAdmin();

  const [step, setStep] = useState(1);
  const [kind, setKind] = useState<ContentKind | null>(null);
  const [lectureSource, setLectureSource] = useState<LectureSourceType>('youtube-video');
  const [bookSource, setBookSource] = useState<BookSourceType>('archive');

  // shared
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scholarIds, setScholarIds] = useState<string[]>([]);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // lecture specific
  const [series, setSeries] = useState('');
  const [format, setFormat] = useState<LectureFormat>('Video');
  const [level, setLevel] = useState<LectureLevel>('Beginner');
  const [durationMin, setDurationMin] = useState(32);
  const [episodes, setEpisodes] = useState(1);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [language, setLanguage] = useState('English');

  // book specific
  const [bookFormat, setBookFormat] = useState<BookFormat>('Translation');
  const [pages, setPages] = useState(180);
  const [year, setYear] = useState(new Date().getFullYear());
  const [publisher, setPublisher] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [isbn, setIsbn] = useState('');
  const [bookLanguage, setBookLanguage] = useState('English');

  const urlOk = useMemo(() => {
    if (!url.trim()) return false;
    if (kind === 'lecture') return isYoutubeUrl(url.trim());
    if (kind === 'book') return isArchiveUrl(url.trim()) || (() => { try { new URL(url); return true; } catch { return false; } })();
    return false;
  }, [url, kind]);

  const canGoNext = useMemo(() => {
    if (step === 1) return Boolean(kind);
    if (step === 2) return true; // source selected always
    if (step === 3) return url.trim().length > 5 && urlOk;
    if (step === 4) return urlOk; // preview step
    if (step === 5) return title.trim().length > 1 && description.trim().length > 0;
    if (step === 6) return scholarIds.length > 0;
    if (step === 7) return subjectIds.length > 0;
    return true;
  }, [step, kind, urlOk, url, title, description, scholarIds, subjectIds]);

  const toggleScholar = (id: string) =>
    setScholarIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleSubject = (id: string) =>
    setSubjectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = (status: PublishStatus) => {
    if (!kind) {
      setError('Choose whether this is a lecture or a book.');
      setStep(1);
      return;
    }
    if (!title.trim() || !url.trim() || scholarIds.length === 0 || subjectIds.length === 0) {
      setError('Title, external URL, at least one scholar and one subject are required.');
      return;
    }
    if (kind === 'lecture') {
      if (!isYoutubeUrl(url.trim())) {
        setError('Enter a valid YouTube URL for lectures (video or playlist).');
        setStep(3);
        return;
      }
      const item: AdminLecture = {
        id: uid('l'),
        title: title.trim(),
        youtubeUrl: url.trim(),
        sourceType: lectureSource,
        scholarId: scholarIds[0]!,
        scholarIds,
        subjectIds,
        description: description.trim(),
        series: series.trim(),
        format,
        level,
        durationMin,
        episodes,
        status,
        updatedAt: todayStamp(),
        thumbnailUrl: thumbnailUrl.trim(),
        language,
        tags: [],
      };
      upsertLecture(item, 'Added');
    } else {
      const trimmed = url.trim();
      const sourceType = bookSource;
      const item: AdminBook = {
        id: uid('b'),
        title: title.trim(),
        archiveUrl: trimmed,
        sourceUrl: trimmed,
        sourceType,
        scholarId: scholarIds[0]!,
        scholarIds,
        subjectIds,
        description: description.trim(),
        format: bookFormat,
        pages,
        year,
        status,
        updatedAt: todayStamp(),
        coverUrl: coverUrl.trim(),
        publisher: publisher.trim(),
        language: bookLanguage,
        isbn: isbn.trim(),
        tags: [],
      };
      upsertBook(item, 'Added');
    }
    navigate(kind === 'lecture' ? '/admin/lectures' : '/admin/books');
  };

  const stepTitle =
    step === 1
      ? 'Add content'
      : step === 2
        ? 'Select external source'
        : step === 3
          ? 'Enter external URL'
          : step === 4
            ? 'Preview embedded content'
            : step === 5
              ? 'Enter metadata'
              : step === 6
                ? 'Assign scholar(s)'
                : step === 7
                  ? 'Assign subject(s)'
                  : step === 8
                    ? 'Review'
                    : 'Save';

  return (
    <div className="mx-auto max-w-[860px]">
      <Link to="/admin" className="text-ink-muted hover:text-rose text-[0.86rem] font-semibold">
        ← Overview
      </Link>

      <div className="mt-5">
        <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.22em] uppercase">Admin · Guided flow</p>
        <h1 className="font-display text-ink mt-2 text-[clamp(1.9rem,4vw,2.7rem)] font-extrabold tracking-tight">Add content — 9 steps</h1>
        <p className="text-ink-soft mt-3 max-w-[640px] text-[0.96rem] leading-relaxed">
          This wizard follows the specified flow: type → source → URL → preview → metadata → scholars → subjects → save. Every piece of content is externally hosted — ilmNet only catalogues it.
        </p>
      </div>

      <div className="mt-8">
        <WorkflowStepper step={Math.min(step, 9)} />
      </div>

      <div className="mt-8 space-y-6">
        <ErrorBanner message={error} />

        {/* Step 1: Content type */}
        {step === 1 && (
          <section className="bg-cream neu-raised rounded-[28px] p-6 sm:p-8">
            <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.2em] uppercase">1 — Select content type</p>
            <h2 className="font-display text-ink mt-2 text-[1.4rem] font-extrabold">What are you adding?</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setKind('lecture')}
                className={`text-left rounded-[22px] p-6 transition-all ${kind === 'lecture' ? 'bg-rose text-cream shadow-[8px_12px_24px_rgba(204,58,99,0.3)]' : 'bg-sand neu-raised-sm hover:-translate-y-0.5'}`}
              >
                <p className={`text-[0.72rem] font-semibold tracking-[0.16em] uppercase ${kind === 'lecture' ? 'text-cream/80' : 'text-ink-muted'}`}>Lecture · YouTube</p>
                <p className={`font-display mt-2 text-[1.25rem] font-extrabold ${kind === 'lecture' ? 'text-cream' : 'text-ink'}`}>Lecture</p>
                <p className={`mt-2 text-[0.9rem] leading-relaxed ${kind === 'lecture' ? 'text-cream/85' : 'text-ink-soft'}`}>A YouTube video or a full playlist. Choose the source type next.</p>
                <div className="mt-5 flex gap-2">
                  <span className={`rounded-full px-3 py-1.5 text-[0.72rem] font-semibold ${kind === 'lecture' ? 'bg-white/15 text-cream' : 'bg-cream text-ink-muted'}`}>Single video</span>
                  <span className={`rounded-full px-3 py-1.5 text-[0.72rem] font-semibold ${kind === 'lecture' ? 'bg-white/15 text-cream' : 'bg-cream text-ink-muted'}`}>Playlist</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setKind('book')}
                className={`text-left rounded-[22px] p-6 transition-all ${kind === 'book' ? 'bg-olive text-[#1d2215] shadow-[8px_12px_24px_rgba(140,150,100,0.32)]' : 'bg-sand neu-raised-sm hover:-translate-y-0.5'}`}
              >
                <p className={`text-[0.72rem] font-semibold tracking-[0.16em] uppercase ${kind === 'book' ? 'text-[#1d2215]/60' : 'text-ink-muted'}`}>Book · Archive.org / external</p>
                <p className={`font-display mt-2 text-[1.25rem] font-extrabold ${kind === 'book' ? 'text-[#1d2215]' : 'text-ink'}`}>Book / Document</p>
                <p className={`mt-2 text-[0.9rem] leading-relaxed ${kind === 'book' ? 'text-[#1d2215]/80' : 'text-ink-soft'}`}>Archive.org scan, Google Books, PDF or any external document URL.</p>
                <div className="mt-5 flex gap-2">
                  <span className={`rounded-full px-3 py-1.5 text-[0.72rem] font-semibold ${kind === 'book' ? 'bg-black/10 text-[#1d2215]' : 'bg-cream text-ink-muted'}`}>Archive.org</span>
                  <span className={`rounded-full px-3 py-1.5 text-[0.72rem] font-semibold ${kind === 'book' ? 'bg-black/10 text-[#1d2215]' : 'bg-cream text-ink-muted'}`}>External</span>
                </div>
              </button>
            </div>
            <p className="text-ink-muted mt-4 text-[0.8rem]">Public site stays free — no login required to view either type.</p>
          </section>
        )}

        {/* Step 2: External source */}
        {step === 2 && (
          <section className="bg-cream neu-raised rounded-[28px] p-6 sm:p-8">
            <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.2em] uppercase">2 — Select external source</p>
            <h2 className="font-display text-ink mt-2 text-[1.4rem] font-extrabold">
              {kind === 'lecture' ? 'Where is the lecture hosted?' : kind === 'book' ? 'Where is the book hosted?' : 'Pick a content type first'}
            </h2>
            {!kind ? (
              <div className="mt-6">
                <GhostButton onClick={() => setStep(1)}>Choose type</GhostButton>
              </div>
            ) : kind === 'lecture' ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {lectureSourceOptions.map((opt) => (
                  <SourceCard
                    key={opt.value}
                    active={lectureSource === opt.value}
                    title={opt.label}
                    hint={opt.hint}
                    onClick={() => setLectureSource(opt.value)}
                    icon={
                      opt.value === 'youtube-playlist' ? (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="18" cy="6" r="1" fill="currentColor" /><circle cx="18" cy="12" r="1" fill="currentColor" /><circle cx="18" cy="18" r="1" fill="currentColor" /></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M8 5.6c0-.9 1-1.5 1.8-1l8.1 5.1a1.2 1.2 0 0 1 0 2L9.8 17c-.8.5-1.8-.1-1.8-1V5.6Z" /></svg>
                      )
                    }
                  />
                ))}
                <div className="sm:col-span-2">
                  <div className="bg-sand/60 rounded-[16px] px-4 py-3 text-[0.82rem] leading-relaxed text-ink-soft">
                    <span className="font-semibold text-ink">Note:</span> ilmNet does not upload or re-host — it embeds the original YouTube player. Playlists use <code className="bg-cream rounded px-1.5 py-0.5">videoseries?list=…</code>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {bookSourceOptions.map((opt) => (
                  <SourceCard
                    key={opt.value}
                    active={bookSource === opt.value}
                    title={opt.label}
                    hint={opt.hint}
                    onClick={() => setBookSource(opt.value)}
                    icon={
                      opt.value === 'archive' ? (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v13" /><path d="M14 19V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z" /></svg>
                      ) : opt.value === 'google-books' ? (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" /><path d="M16 8h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2" /></svg>
                      ) : opt.value === 'pdf' ? (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v5h5" /><path d="M10 13h4M10 17h6" /></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                      )
                    }
                  />
                ))}
                <div className="sm:col-span-2">
                  <div className="bg-sand/60 rounded-[16px] px-4 py-3 text-[0.82rem] leading-relaxed text-ink-soft">
                    Designed around <span className="font-semibold text-ink">any external URL</span> — not only Archive.org. The preview adapts: Archive.org → embedded reader, PDF → iframe, Google Books → front-cover preview, generic → link card.
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Step 3: Enter URL */}
        {step === 3 && (
          <section className="bg-sand neu-raised rounded-[28px] p-6 sm:p-8">
            <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.2em] uppercase">3 — Enter the external URL</p>
            <h2 className="font-display text-ink mt-2 text-[1.4rem] font-extrabold">
              {kind === 'lecture'
                ? lectureSource === 'youtube-playlist'
                  ? 'Paste the YouTube playlist link'
                  : 'Paste the YouTube video link'
                : bookSource === 'archive'
                  ? 'Paste the Archive.org link'
                  : bookSource === 'google-books'
                    ? 'Paste the Google Books link'
                    : bookSource === 'pdf'
                      ? 'Paste the direct PDF link'
                      : 'Paste the external document link'}
            </h2>
            <div className="mt-6">
              <Field
                label={
                  kind === 'lecture'
                    ? lectureSource === 'youtube-playlist'
                      ? 'YouTube playlist URL'
                      : 'YouTube video URL'
                    : bookSource === 'archive'
                      ? 'Archive.org URL'
                      : bookSource === 'google-books'
                        ? 'Google Books URL'
                        : 'External document URL'
                }
                required
                hint={
                  kind === 'lecture'
                    ? 'Examples: https://www.youtube.com/watch?v=…  •  https://youtu.be/…  •  https://www.youtube.com/playlist?list=…'
                    : bookSource === 'archive'
                      ? 'Example: https://archive.org/details/… — the scan stays on Archive.org, we only embed the reader.'
                      : bookSource === 'pdf'
                        ? 'Example: https://publisher.example/books/title.pdf'
                        : 'Any http(s) URL. We will link, not re-host.'
                }
              >
                <TextInput
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError(null);
                  }}
                  placeholder={
                    kind === 'lecture'
                      ? lectureSource === 'youtube-playlist'
                        ? 'https://www.youtube.com/playlist?list=PL…'
                        : 'https://www.youtube.com/watch?v=…'
                      : bookSource === 'archive'
                        ? 'https://archive.org/details/…'
                        : bookSource === 'google-books'
                          ? 'https://books.google.com/books?id=…'
                          : 'https://…'
                  }
                  inputMode="url"
                />
                <div className="mt-3">
                  {kind === 'lecture' ? (
                    <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.78rem] font-medium ${urlOk ? 'bg-olive/15 text-olive-deep' : url.trim() ? 'bg-rose/10 text-rose' : 'bg-sand text-ink-muted'}`}>
                      <span className={`h-2 w-2 rounded-full ${urlOk ? 'bg-olive' : 'bg-rose'}`} />
                      {url.trim() ? (urlOk ? (lectureSource === 'youtube-playlist' ? 'Playlist URL looks valid — will embed as videoseries' : 'YouTube URL recognised') : 'Not a YouTube URL — check the link') : 'Waiting for URL…'}
                    </div>
                  ) : kind === 'book' ? (
                    <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.78rem] font-medium ${urlOk ? 'bg-olive/15 text-olive-deep' : url.trim() ? 'bg-rose/10 text-rose' : 'bg-sand text-ink-muted'}`}>
                      <span className={`h-2 w-2 rounded-full ${urlOk ? 'bg-olive' : 'bg-rose'}`} />
                      {url.trim() ? (urlOk ? `${bookSource} link ready for preview` : 'Enter a valid http(s) URL') : 'Waiting for URL…'}
                    </div>
                  ) : null}
                </div>
              </Field>

              {/* quick fill examples */}
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.1em] uppercase">Try example:</span>
                {kind === 'lecture' ? (
                  <>
                    <button type="button" onClick={() => setUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')} className="bg-cream neu-raised-sm rounded-full px-3 py-1.5 text-[0.78rem] font-medium">Video example</button>
                    <button type="button" onClick={() => setUrl('https://www.youtube.com/playlist?list=PLQ5aNFhB5PJ6p9F0Y8jX8x8x8x8x8x8x8x8x')} className="bg-cream neu-raised-sm rounded-full px-3 py-1.5 text-[0.78rem] font-medium">Playlist example</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => setUrl('https://archive.org/details/ilmnet-removal-of-doubts')} className="bg-cream neu-raised-sm rounded-full px-3 py-1.5 text-[0.78rem] font-medium">Archive.org</button>
                    <button type="button" onClick={() => setUrl('https://books.google.com/books?id=quduri_mukhtasar_example')} className="bg-cream neu-raised-sm rounded-full px-3 py-1.5 text-[0.78rem] font-medium">Google Books</button>
                    <button type="button" onClick={() => setUrl('https://example.com/books/al-adhkar.pdf')} className="bg-cream neu-raised-sm rounded-full px-3 py-1.5 text-[0.78rem] font-medium">PDF</button>
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Step 4: Preview */}
        {step === 4 && (
          <section className="space-y-6">
            <div className="bg-cream neu-raised rounded-[28px] p-6 sm:p-8">
              <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.2em] uppercase">4 — Preview the embedded content</p>
              <h2 className="font-display text-ink mt-2 text-[1.4rem] font-extrabold">How the public will see it</h2>
              <p className="text-ink-soft mt-2 text-[0.9rem] leading-relaxed">This is a live embed. If it loads here, it will load in the library. Nothing is re-hosted — the source stays external.</p>
            </div>

            <div className="bg-sand neu-inset rounded-[28px] p-4 sm:p-6">
              <p className="text-ink-muted mb-3 text-[0.72rem] font-semibold tracking-[0.14em] uppercase">External URL</p>
              <p className="text-ink break-all rounded-[12px] bg-cream px-4 py-3 text-[0.9rem] font-medium neu-inset">{url || '—'}</p>
              <div className="mt-6">
                {!url.trim() ? (
                  <div className="bg-cream neu-inset rounded-[20px] px-6 py-14 text-center">
                    <p className="font-display text-ink text-[1.1rem] font-bold">No URL yet</p>
                    <p className="text-ink-muted mt-2 text-[0.9rem]">Go back and paste a link.</p>
                  </div>
                ) : kind === 'lecture' ? (
                  getYoutubeEmbedUrl(url) ? (
                    <YoutubeEmbed url={url} />
                  ) : (
                    <div className="bg-rose/10 text-rose rounded-[20px] px-6 py-10 text-center">Unable to embed this YouTube URL — check video / playlist ID.</div>
                  )
                ) : kind === 'book' ? (
                  bookSource === 'archive' ? (
                    getArchiveEmbedUrl(url) ? (
                      <ArchiveEmbed url={url} />
                    ) : (
                      <div className="bg-rose/10 text-rose rounded-[20px] px-6 py-10 text-center">Not an Archive.org details URL — try https://archive.org/details/…</div>
                    )
                  ) : (
                    <ExternalEmbed url={url} type={bookSource} />
                  )
                ) : (
                  <div className="bg-cream rounded-[20px] p-6 text-ink-muted">Choose a content type first.</div>
                )}
              </div>

              {/* thumbnail / cover quick fields here as optional too */}
              {kind === 'lecture' && (
                <div className="mt-6 rounded-[20px] bg-cream neu-raised-sm p-5">
                  <MediaField
                    value={thumbnailUrl}
                    onChange={setThumbnailUrl}
                    title={title || 'Lecture'}
                    label="Thumbnail / cover image — optional"
                    hint="Upload a custom image (always wins), paste a URL, or leave empty to use the provider thumbnail."
                    providerUrl={(() => { try { const e = getYoutubeEmbedUrl(url); const m = e?.match(/\/embed\/([^?]+)/); return m && m[1] !== 'videoseries' ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null; } catch { return null; } })()}
                    testId="wizard-thumbnail"
                  />
                </div>
              )}
              {kind === 'book' && (
                <div className="mt-6 rounded-[20px] bg-cream neu-raised-sm p-5">
                  <MediaField
                    value={coverUrl}
                    onChange={setCoverUrl}
                    title={title || 'Book'}
                    label="Cover image — optional"
                    shape="cover"
                    hint="Upload a custom cover (always wins) or leave empty to use the provider cover / generated spine."
                    testId="wizard-cover"
                  />
                  {bookSource === 'external' && getBookEmbedUrl(url, bookSource as any) === null && (
                    <p className="text-ink-muted mt-3 text-[0.72rem]">External links show a link card (no iframe) — the public “Read” button will open the source in a new tab.</p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Step 5: Metadata */}
        {step === 5 && (
          <section className="space-y-6">
            <div className="bg-cream neu-raised rounded-[28px] p-6 sm:p-8">
              <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.2em] uppercase">5 — Enter metadata</p>
              <h2 className="font-display text-ink mt-2 text-[1.4rem] font-extrabold">Describe it for the library</h2>
              <p className="text-ink-soft mt-2 text-[0.9rem]">Clear titles and a short description help readers find this in search and on subject shelves.</p>
            </div>

            {kind === 'lecture' ? (
              <div className="space-y-6">
                <div className="bg-sand neu-raised rounded-[28px] p-6 sm:p-8 space-y-5">
                  <Field label="Title" required>
                    <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Opening the Qurʾān: Sūrat al-Fātiḥah" />
                  </Field>
                  <Field label="Short description" hint="One or two sentences for the public card and search.">
                    <TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A slow reading of the Opening, with vocabulary, context and the classical commentaries." />
                  </Field>
                  <MediaField
                    value={thumbnailUrl}
                    onChange={setThumbnailUrl}
                    title={title || 'Lecture'}
                    label="Thumbnail / cover image"
                    testId="wizard-thumbnail-step"
                  />
                </div>

                <div className="bg-cream neu-raised rounded-[28px] p-6 sm:p-8 space-y-5">
                  <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.2em] uppercase">Additional lecture metadata</p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Series">
                      <TextInput value={series} onChange={(e) => setSeries(e.target.value)} placeholder="Tafsīr Foundations" />
                    </Field>
                    <Field label="Format">
                      <SelectInput value={format} onChange={(e) => setFormat(e.target.value as LectureFormat)}>
                        {lectureFormats.map((f) => (
                          <option key={f}>{f}</option>
                        ))}
                      </SelectInput>
                    </Field>
                    <Field label="Level">
                      <SelectInput value={level} onChange={(e) => setLevel(e.target.value as LectureLevel)}>
                        {lectureLevels.map((f) => (
                          <option key={f}>{f}</option>
                        ))}
                      </SelectInput>
                    </Field>
                    <Field label="Language">
                      <SelectInput value={language} onChange={(e) => setLanguage(e.target.value)}>
                        <option>English</option>
                        <option>English / Arabic</option>
                        <option>Arabic</option>
                        <option>Urdu</option>
                        <option>French</option>
                      </SelectInput>
                    </Field>
                    <Field label="Minutes per episode">
                      <TextInput type="number" min={1} value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value) || 0)} />
                    </Field>
                    <Field label="Episodes">
                      <TextInput type="number" min={1} value={episodes} onChange={(e) => setEpisodes(Number(e.target.value) || 1)} />
                    </Field>
                  </div>
                  <div className="rounded-[16px] bg-sand/60 px-4 py-3 text-[0.78rem] text-ink-muted">
                    Source: <span className="font-semibold text-ink">{lectureSource === 'youtube-playlist' ? 'YouTube playlist' : 'YouTube video'}</span> · URL: <span className="break-all font-mono text-[0.72rem]">{url || '—'}</span>
                  </div>
                </div>
              </div>
            ) : kind === 'book' ? (
              <div className="space-y-6">
                <div className="bg-sand neu-raised rounded-[28px] p-6 sm:p-8 space-y-5">
                  <Field label="Title" required>
                    <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The Removal of Doubts" />
                  </Field>
                  <Field label="Short description" hint="For the public book card.">
                    <TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A line-by-line commentary for the modern reader." />
                  </Field>
                  <MediaField
                    value={coverUrl}
                    onChange={setCoverUrl}
                    title={title || 'Book'}
                    label="Cover image"
                    shape="cover"
                    testId="wizard-cover-step"
                  />
                </div>

                <div className="bg-cream neu-raised rounded-[28px] p-6 sm:p-8 space-y-5">
                  <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.2em] uppercase">Publication / page metadata where appropriate</p>
                  <div className="grid gap-5 sm:grid-cols-3">
                    <Field label="Edition">
                      <SelectInput value={bookFormat} onChange={(e) => setBookFormat(e.target.value as BookFormat)}>
                        {bookFormats.map((f) => (
                          <option key={f}>{f}</option>
                        ))}
                      </SelectInput>
                    </Field>
                    <Field label="Pages">
                      <TextInput type="number" min={1} value={pages} onChange={(e) => setPages(Number(e.target.value) || 0)} />
                    </Field>
                    <Field label="Year">
                      <TextInput type="number" min={1} value={year} onChange={(e) => setYear(Number(e.target.value) || 0)} />
                    </Field>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Publisher">
                      <TextInput value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="Dar al-Kutub · publisher site" />
                    </Field>
                    <Field label="Language">
                      <SelectInput value={bookLanguage} onChange={(e) => setBookLanguage(e.target.value)}>
                        <option>English</option>
                        <option>Arabic</option>
                        <option>Arabic / English</option>
                        <option>Urdu</option>
                        <option>French</option>
                      </SelectInput>
                    </Field>
                    <Field label="ISBN — optional" hint="13-digit where available">
                      <TextInput value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="978-…" />
                    </Field>
                    <Field label="External source type">
                      <div className="bg-sand neu-inset rounded-[16px] px-4 py-3 text-[0.86rem] font-medium">{bookSource}</div>
                    </Field>
                  </div>
                  <div className="rounded-[16px] bg-sand/60 px-4 py-3 text-[0.78rem] text-ink-muted">
                    External URL: <span className="break-all font-mono text-[0.72rem]">{url || '—'}</span> · Cover stays external too.
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-cream neu-raised rounded-[28px] p-8 text-center text-ink-muted">Choose a content type first (step 1).</div>
            )}
          </section>
        )}

        {/* Step 6: Scholars */}
        {step === 6 && (
          <section className="bg-cream neu-raised rounded-[28px] p-6 sm:p-8">
            <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.2em] uppercase">6 — Assign scholar(s)</p>
            <h2 className="font-display text-ink mt-2 text-[1.4rem] font-extrabold">Who taught or authored this?</h2>
            <p className="text-ink-soft mt-2 text-[0.9rem]">Select one or many. A lecture by two shaykhs or a book with co-authors is supported. Create a new scholar first if they are not listed.</p>

            <div className="mt-6 rounded-[20px] bg-sand neu-inset p-4">
              <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.14em] uppercase">{scholarIds.length} selected</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {scholars.map((s) => {
                  const on = scholarIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleScholar(s.id)}
                      className={`flex items-center gap-2.5 rounded-full px-3 py-2 pr-4 text-[0.88rem] font-semibold transition-all ${on ? 'bg-rose text-cream shadow-[6px_8px_14px_rgba(204,58,99,0.26)]' : 'bg-cream neu-raised-sm text-ink hover:-translate-y-0.5'}`}
                    >
                      <span className={`grid h-7 w-7 place-items-center rounded-full text-[0.72rem] font-bold ${on ? 'bg-white/20 text-cream' : s.accent === 'rose' ? 'bg-rose/15 text-rose' : 'bg-olive/20 text-olive-deep'}`}>{s.initials}</span>
                      {s.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-ink-muted mt-4 text-[0.78rem]"><Link to="/admin/scholars/new" target="_blank" className="text-rose font-semibold">＋ Add a new scholar</Link> in another tab if needed, then return.</p>
            </div>

            {scholarIds.length === 0 && <p className="text-rose mt-4 text-[0.82rem] font-medium">Required — attach at least one scholar.</p>}
          </section>
        )}

        {/* Step 7: Subjects */}
        {step === 7 && (
          <section className="bg-cream neu-raised rounded-[28px] p-6 sm:p-8">
            <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.2em] uppercase">7 — Assign subject(s)</p>
            <h2 className="font-display text-ink mt-2 text-[1.4rem] font-extrabold">Which shelves does it sit on?</h2>
            <p className="text-ink-soft mt-2 text-[0.9rem]">A lecture on Ḥadīth ethics can sit on both <span className="font-semibold text-ink">Ḥadīth</span> and <span className="font-semibold text-ink">Ethics</span>. Pick at least one.</p>

            <div className="mt-6">
              <ChipToggle options={subjects.map((s) => ({ value: s.id, label: s.name }))} selected={subjectIds} onToggle={toggleSubject} />
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {subjects
                .filter((s) => subjectIds.includes(s.id))
                .map((s) => (
                  <span key={s.id} className="bg-olive/20 text-olive-deep rounded-full px-3 py-1.5 text-[0.78rem] font-semibold">
                    {s.name} · {s.group}
                  </span>
                ))}
              {subjectIds.length === 0 && <span className="text-rose text-[0.82rem] font-medium">Pick at least one subject.</span>}
            </div>
            <p className="text-ink-muted mt-4 text-[0.78rem]">
              <Link to="/admin/subjects/new" target="_blank" className="text-rose font-semibold">＋ Add a new subject</Link> if the right shelf does not exist.
            </p>
          </section>
        )}

        {/* Step 8: Review */}
        {step === 8 && (
          <section className="space-y-6">
            <div className="bg-cream neu-raised rounded-[28px] p-6 sm:p-8">
              <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.2em] uppercase">8 — Review</p>
              <h2 className="font-display text-ink mt-2 text-[1.4rem] font-extrabold">Check before it goes live</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="bg-sand neu-inset rounded-[20px] p-5">
                  <p className="text-ink-muted text-[0.68rem] font-semibold tracking-[0.14em] uppercase">Content</p>
                  <p className="font-display text-ink mt-1 text-[1.05rem] font-bold leading-tight">{title || 'Untitled'}</p>
                  <p className="text-ink-muted mt-1 text-[0.82rem] capitalize">{kind} · {kind === 'lecture' ? lectureSource.replace('youtube-', '') : bookSource}</p>
                  <p className="text-ink-soft mt-3 break-all text-[0.78rem]">{url}</p>
                </div>
                <div className="bg-sand neu-inset rounded-[20px] p-5">
                  <p className="text-ink-muted text-[0.68rem] font-semibold tracking-[0.14em] uppercase">Classification</p>
                  <p className="text-ink text-[0.9rem] font-semibold">Scholars: {scholarIds.length ? scholarIds.map((id) => scholars.find((s) => s.id === id)?.name).join(', ') : '— none —'}</p>
                  <p className="text-ink mt-1 text-[0.9rem] font-semibold">Subjects: {subjectIds.length ? subjectIds.map((id) => subjects.find((s) => s.id === id)?.name).join(', ') : '— none —'}</p>
                </div>
              </div>
              <div className="mt-4 rounded-[16px] bg-sand/60 px-4 py-3 text-[0.82rem] text-ink-muted">
                Metadata · {kind === 'lecture' ? `${format} · ${level} · ${episodes} ep · ${durationMin} min` : `${bookFormat} · ${pages} pp · ${year} · ${publisher || 'no publisher'}`}
              </div>
            </div>

            <div className="bg-sand neu-inset rounded-[28px] p-4 sm:p-5">
              <p className="text-ink-muted mb-3 text-[0.72rem] font-semibold tracking-[0.14em] uppercase">Live embed check</p>
              {kind === 'lecture' && url && getYoutubeEmbedUrl(url) && <YoutubeEmbed url={url} />}
              {kind === 'book' && url && bookSource === 'archive' && getArchiveEmbedUrl(url) && <ArchiveEmbed url={url} />}
              {kind === 'book' && url && bookSource !== 'archive' && <ExternalEmbed url={url} type={bookSource} />}
              {!url && <p className="text-ink-muted text-[0.9rem]">No URL.</p>}
            </div>
          </section>
        )}

        {/* Navigation */}
        <div className="border-line/60 flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <GhostButton onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
              Back
            </GhostButton>
            <Link to="/admin" className="text-ink-muted hover:text-rose px-4 py-3 text-[0.86rem] font-semibold">
              Cancel
            </Link>
          </div>

          {step < 8 ? (
            <PrimaryButton onClick={() => { setError(null); setStep((s) => s + 1); }} disabled={!canGoNext}>
              Continue → <span className="ml-2 text-[0.78rem] font-normal opacity-80">{stepTitle}</span>
            </PrimaryButton>
          ) : step === 8 ? (
            <PrimaryButton onClick={() => setStep(9)} disabled={!canGoNext}>
              Ready to publish →
            </PrimaryButton>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <GhostButton onClick={() => save('draft')} disabled={!canGoNext}>
                Save as draft
              </GhostButton>
              <PrimaryButton onClick={() => save('published')} disabled={!canGoNext}>
                Publish to library
              </PrimaryButton>
            </div>
          )}
        </div>

        <p className="text-ink-muted text-center text-[0.76rem]">
          Step {step} of 9 · <span className="font-semibold">{stepTitle}</span> {step < 9 && '· nothing is permanent yet — this is still frontend only.'}
        </p>
      </div>
    </div>
  );
}
