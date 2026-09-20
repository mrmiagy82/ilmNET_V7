import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  bookFormats,
  isArchiveUrl,
  todayStamp,
  uid,
  type AdminBook,
  type BookFormat,
  type PublishStatus,
} from './data';
import { useAdmin } from './store';
import {
  ChipToggle,
  ErrorBanner,
  Field,
  GhostButton,
  PageIntro,
  PrimaryButton,
  SelectInput,
  SourcePreview,
  TextArea,
  TextInput,
} from './ui';

const empty: Omit<AdminBook, 'id' | 'updatedAt'> = {
  title: '',
  archiveUrl: '',
  scholarId: '',
  subjectIds: [],
  description: '',
  format: 'Translation',
  pages: 120,
  year: new Date().getFullYear(),
  status: 'draft',
};

export default function BookForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { books, scholars, subjects, upsertBook } = useAdmin();
  const existing = id ? books.find((b) => b.id === id) : undefined;
  const isNew = !id;

  const [form, setForm] = useState<Omit<AdminBook, 'id' | 'updatedAt'>>(() =>
    existing
      ? {
          title: existing.title,
          archiveUrl: existing.archiveUrl,
          scholarId: existing.scholarId,
          subjectIds: existing.subjectIds,
          description: existing.description,
          format: existing.format,
          pages: existing.pages,
          year: existing.year,
          status: existing.status,
        }
      : empty
  );
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

  const save = (status: PublishStatus) => {
    if (!form.title.trim() || !form.archiveUrl.trim() || !form.scholarId || form.subjectIds.length === 0) {
      setError('Title, Archive.org URL, author and at least one subject are required.');
      return;
    }
    const item: AdminBook = {
      id: existing?.id ?? uid('b'),
      ...form,
      title: form.title.trim(),
      archiveUrl: form.archiveUrl.trim(),
      description: form.description.trim(),
      status,
      updatedAt: todayStamp(),
    };
    upsertBook(item, existing ? 'Updated' : 'Added');
    navigate('/admin/books');
  };

  return (
    <div className="mx-auto max-w-[760px]">
      <Link to="/admin/books" className="text-ink-muted hover:text-rose text-[0.86rem] font-semibold">
        ← Books
      </Link>
      <div className="mt-5">
        <PageIntro
          eyebrow={isNew ? 'New book' : 'Edit book'}
          title={isNew ? 'Add an Archive.org book' : existing!.title}
          intro="Paste the Archive.org URL first. Then name the work, attach its author and subjects, and publish when it is ready."
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
          <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.2em] uppercase">Source</p>
          <div className="mt-5">
            <Field
              label="Archive.org URL"
              required
              hint="ilmNet catalogues the edition — the scan stays on Archive.org."
            >
              <TextInput
                value={form.archiveUrl}
                onChange={(e) => set('archiveUrl', e.target.value)}
                placeholder="https://archive.org/details/…"
                inputMode="url"
              />
              <SourcePreview url={form.archiveUrl} ok={isArchiveUrl(form.archiveUrl)} expect="Archive.org" />
            </Field>
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
        </section>

        <section className="bg-cream neu-raised space-y-6 rounded-[28px] p-6 sm:p-8">
          <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.2em] uppercase">Classification</p>
          <Field label="Author / scholar" required hint="Choose the scholar who authored or presented this edition.">
            <SelectInput value={form.scholarId} onChange={(e) => set('scholarId', e.target.value)}>
              <option value="">Select a scholar…</option>
              {scholars.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectInput>
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
