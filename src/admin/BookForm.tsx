import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  bookFormats,
  bookSourceOptions,
  detectBookSource,
  getArchiveEmbedUrl,
  getBookEmbedUrl,
  isArchiveUrl,
  todayStamp,
  uid,
  type AdminBook,
  type BookFormat,
  type BookSourceType,
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
  PageIntro,
  PrimaryButton,
  SelectInput,
  SourceCard,
  TextArea,
  TextInput,
} from './ui';

const empty: Omit<AdminBook, 'id' | 'updatedAt'> = {
  title: '',
  archiveUrl: '',
  sourceUrl: '',
  sourceType: 'archive',
  scholarId: '',
  scholarIds: [],
  subjectIds: [],
  description: '',
  format: 'Translation',
  pages: 120,
  year: new Date().getFullYear(),
  status: 'draft',
  coverUrl: '',
  publisher: '',
  language: 'English',
  isbn: '',
  tags: [],
};

export default function BookForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { books, scholars, subjects, upsertBook } = useAdmin();
  const existing = id ? books.find((b) => b.id === id) : undefined;
  const isNew = !id;

  const [form, setForm] = useState<Omit<AdminBook, 'id' | 'updatedAt'>>(() => {
    if (existing) {
      const src = existing.sourceType ?? detectBookSource(existing.archiveUrl) ?? 'archive';
      return {
        title: existing.title,
        archiveUrl: existing.archiveUrl,
        sourceUrl: existing.sourceUrl ?? existing.archiveUrl,
        sourceType: src as BookSourceType,
        scholarId: existing.scholarId,
        scholarIds: existing.scholarIds ?? (existing.scholarId ? [existing.scholarId] : []),
        subjectIds: existing.subjectIds,
        description: existing.description,
        format: existing.format,
        pages: existing.pages,
        year: existing.year,
        status: existing.status,
        coverUrl: existing.coverUrl ?? '',
        publisher: existing.publisher ?? '',
        language: existing.language ?? 'English',
        isbn: existing.isbn ?? '',
        tags: existing.tags ?? [],
      };
    }
    return empty;
  });
  const [error, setError] = useState<string | null>(null);

  if (id && !existing) {
    return (
      <div className="mx-auto max-w-[720px]">
        <PageIntro eyebrow="Books" title="Not found" intro="This book is no longer on the desk." />
        <div className="mt-8">
          <GhostButton to="/admin/books">Back to books</GhostButton>
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

  const effectiveUrl = form.sourceUrl?.trim() ? form.sourceUrl.trim() : form.archiveUrl.trim();
  const urlOk = useMemo(() => {
    if (!effectiveUrl) return false;
    if (form.sourceType === 'archive') return isArchiveUrl(effectiveUrl);
    try {
      new URL(effectiveUrl);
      return true;
    } catch {
      return false;
    }
  }, [effectiveUrl, form.sourceType]);
  const embedUrl = useMemo(() => getBookEmbedUrl(effectiveUrl, form.sourceType as BookSourceType), [effectiveUrl, form.sourceType]);
  const archiveEmbed = useMemo(() => getArchiveEmbedUrl(effectiveUrl), [effectiveUrl]);

  const save = (status: PublishStatus) => {
    const scholarsChosen = form.scholarIds && form.scholarIds.length > 0 ? form.scholarIds : form.scholarId ? [form.scholarId] : [];
    if (!form.title.trim() || !effectiveUrl || scholarsChosen.length === 0 || form.subjectIds.length === 0) {
      setError('Title, external URL, at least one author/scholar and one subject are required.');
      return;
    }
    // validate by source
    if (form.sourceType === 'archive' && !isArchiveUrl(effectiveUrl)) {
      setError('For Archive.org source, use a URL like https://archive.org/details/…');
      return;
    }
    try {
      new URL(effectiveUrl);
    } catch {
      setError('Enter a valid http(s) URL.');
      return;
    }
    const item: AdminBook = {
      id: existing?.id ?? uid('b'),
      ...form,
      title: form.title.trim(),
      archiveUrl: effectiveUrl,
      sourceUrl: effectiveUrl,
      description: form.description.trim(),
      coverUrl: form.coverUrl?.trim(),
      publisher: form.publisher?.trim(),
      language: form.language?.trim(),
      isbn: form.isbn?.trim(),
      scholarId: scholarsChosen[0]!,
      scholarIds: scholarsChosen,
      status,
      updatedAt: todayStamp(),
    };
    upsertBook(item, existing ? 'Updated' : 'Added');
    navigate('/admin/books');
  };

  const onSourceTypeChange = (t: BookSourceType) => {
    set('sourceType', t);
  };

  const onUrlChange = (v: string) => {
    set('archiveUrl', v);
    set('sourceUrl', v);
  };

  return (
    <div className="mx-auto max-w-[760px]">
      <Link to="/admin/books" className="text-ink-muted hover:text-rose text-[0.86rem] font-semibold">
        ← Books
      </Link>
      <div className="mt-5">
        <PageIntro
          eyebrow={isNew ? 'New book — externally hosted' : 'Edit book'}
          title={isNew ? 'Add an externally hosted book' : existing!.title}
          intro="Books are never uploaded to ilmNet — paste an Archive.org link, a Google Books link, a direct PDF, or any external document URL, then preview the reader."
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

        <section className="bg-sand neu-raised rounded-[28px] p-6 sm:p-8">
          <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.2em] uppercase">External source</p>
          <p className="text-ink-soft mt-1 text-[0.86rem]">Choose where this edition lives — not locked to Archive.org only.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {bookSourceOptions.map((opt) => (
              <SourceCard
                key={opt.value}
                active={form.sourceType === opt.value}
                title={opt.label}
                hint={opt.hint}
                onClick={() => onSourceTypeChange(opt.value)}
                icon={
                  opt.value === 'archive' ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v13" /><path d="M14 19V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z" /></svg>
                  ) : opt.value === 'google-books' ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" /></svg>
                  ) : opt.value === 'pdf' ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h8l4 4v14H7Z" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                  )
                }
              />
            ))}
          </div>

          <div className="mt-6">
            <Field
              label={
                form.sourceType === 'archive'
                  ? 'Archive.org URL'
                  : form.sourceType === 'google-books'
                    ? 'Google Books URL'
                    : form.sourceType === 'pdf'
                      ? 'Direct PDF URL'
                      : 'External document URL'
              }
              required
              hint={
                form.sourceType === 'archive'
                  ? 'Example: https://archive.org/details/… — the scan stays on Archive.org.'
                  : form.sourceType === 'pdf'
                    ? 'Direct link ending in .pdf — will embed in an iframe.'
                    : form.sourceType === 'google-books'
                      ? 'Example: https://books.google.com/books?id=… — front-cover preview embedded.'
                      : 'Any hosted document — ilmNet only catalogues and links to it.'
              }
            >
              <TextInput
                value={effectiveUrl}
                onChange={(e) => onUrlChange(e.target.value)}
                placeholder={
                  form.sourceType === 'archive'
                    ? 'https://archive.org/details/…'
                    : form.sourceType === 'google-books'
                      ? 'https://books.google.com/books?id=…'
                      : form.sourceType === 'pdf'
                        ? 'https://example.com/books/title.pdf'
                        : 'https://…'
                }
                inputMode="url"
              />
              {effectiveUrl && (
                <div className={`mt-3 flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.78rem] font-medium ${urlOk ? 'bg-olive/15 text-olive-deep' : 'bg-rose/10 text-rose'}`}>
                  <span className={`h-2 w-2 rounded-full ${urlOk ? 'bg-olive' : 'bg-rose'}`} />
                  {urlOk ? `${form.sourceType} link ready` : form.sourceType === 'archive' ? 'Not an Archive.org details URL' : 'Not a valid URL'}
                </div>
              )}
            </Field>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => onUrlChange('https://archive.org/details/ilmnet-removal-of-doubts')} className="bg-cream neu-raised-sm rounded-full px-3 py-1.5 text-[0.78rem] font-medium">Archive.org</button>
              <button type="button" onClick={() => onUrlChange('https://books.google.com/books?id=quduri_mukhtasar_example')} className="bg-cream neu-raised-sm rounded-full px-3 py-1.5 text-[0.78rem] font-medium">Google Books</button>
              <button type="button" onClick={() => onUrlChange('https://example.com/books/al-adhkar.pdf')} className="bg-cream neu-raised-sm rounded-full px-3 py-1.5 text-[0.78rem] font-medium">PDF</button>
            </div>
          </div>
        </section>

        {/* Preview embedded */}
        <section className="bg-cream neu-raised rounded-[28px] p-6 sm:p-8">
          <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.2em] uppercase">Preview embedded content</p>
          <p className="text-ink-soft mt-2 text-[0.86rem]">How readers will experience this book — externally hosted reader stays external.</p>
          <div className="mt-5">
            {!effectiveUrl ? (
              <div className="bg-sand neu-inset rounded-[20px] px-6 py-10 text-center text-ink-muted text-[0.9rem]">Paste a URL above to preview.</div>
            ) : form.sourceType === 'archive' ? (
              archiveEmbed ? (
                <ArchiveEmbed url={effectiveUrl} />
              ) : (
                <div className="bg-rose/10 text-rose rounded-[20px] px-6 py-8 text-center text-[0.9rem]">Enter an Archive.org details URL to embed — e.g. https://archive.org/details/…</div>
              )
            ) : embedUrl ? (
              <ExternalEmbed url={effectiveUrl} type={form.sourceType ?? 'external'} />
            ) : (
              <ExternalEmbed url={effectiveUrl} type={form.sourceType ?? 'external'} />
            )}
          </div>
        </section>

        <section className="space-y-5">
          <Field label="Title" required>
            <TextInput value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Gardens of the Righteous" />
          </Field>
          <Field label="Short description" hint="One or two sentences for the public library card.">
            <TextArea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What this edition is, and who it is for."
            />
          </Field>
          <MediaField
            value={form.coverUrl ?? ''}
            onChange={(url: string) => set('coverUrl', url)}
            title={form.title || 'Book'}
            label="Cover image"
            shape="cover"
            hint="Optional — a custom upload overrides the provider cover and the generated book spine."
            providerUrl={null}
            testId="book-cover"
          />
        </section>

        <section className="bg-cream neu-raised space-y-6 rounded-[28px] p-6 sm:p-8">
          <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.2em] uppercase">Classification</p>
          <Field label="Author / scholar(s)" required hint="Can credit multiple scholars — for co-authored or translated works.">
            <div className="flex flex-wrap gap-2">
              {scholars.map((s) => {
                const on = (form.scholarIds ?? []).includes(s.id) || form.scholarId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleScholar(s.id)}
                    className={`flex items-center gap-2 rounded-full px-3 py-2 text-[0.84rem] font-semibold ${on ? 'bg-olive text-cream' : 'bg-cream neu-raised-sm text-ink hover:-translate-y-0.5'}`}
                  >
                    <span className={`grid h-6 w-6 place-items-center rounded-full text-[0.7rem] font-bold ${on ? 'bg-white/20 text-cream' : s.accent === 'rose' ? 'bg-rose/15 text-rose' : 'bg-olive/20 text-olive-deep'}`}>{s.initials}</span>
                    {s.name}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Subjects" required hint="A book can sit on more than one shelf.">
            <ChipToggle
              options={subjects.map((s) => ({ value: s.id, label: s.name }))}
              selected={form.subjectIds}
              onToggle={toggleSubject}
            />
          </Field>
        </section>

        <section className="grid gap-5 sm:grid-cols-3">
          <Field label="Edition">
            <SelectInput value={form.format} onChange={(e) => set('format', e.target.value as BookFormat)}>
              {bookFormats.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Pages">
            <TextInput
              type="number"
              min={1}
              value={form.pages}
              onChange={(e) => set('pages', Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Year">
            <TextInput
              type="number"
              min={1}
              value={form.year}
              onChange={(e) => set('year', Number(e.target.value) || 0)}
            />
          </Field>
        </section>
        <section className="grid gap-5 sm:grid-cols-2">
          <Field label="Publisher">
            <TextInput value={form.publisher ?? ''} onChange={(e) => set('publisher', e.target.value)} placeholder="Dar al-Kutub · or external host name" />
          </Field>
          <Field label="Language">
            <SelectInput value={form.language ?? 'English'} onChange={(e) => set('language', e.target.value)}>
              <option>English</option>
              <option>Arabic</option>
              <option>Arabic / English</option>
              <option>Urdu</option>
              <option>French</option>
            </SelectInput>
          </Field>
          <Field label="ISBN">
            <TextInput value={form.isbn ?? ''} onChange={(e) => set('isbn', e.target.value)} placeholder="978-…" />
          </Field>
          <Field label="External host type">
            <div className="bg-sand neu-inset rounded-[16px] px-4 py-3 text-[0.86rem] font-medium capitalize">{form.sourceType}</div>
          </Field>
        </section>

        <div className="border-line/80 flex flex-col gap-3 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
          <GhostButton to="/admin/books">Cancel</GhostButton>
          <div className="flex flex-col gap-3 sm:flex-row">
            <GhostButton onClick={() => save('draft')}>Save as draft</GhostButton>
            <PrimaryButton onClick={() => save('published')}>Publish to library</PrimaryButton>
          </div>
        </div>
      </form>
    </div>
  );
}
