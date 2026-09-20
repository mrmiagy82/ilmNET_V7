import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  isYoutubeUrl,
  lectureFormats,
  lectureLevels,
  todayStamp,
  uid,
  type AdminLecture,
  type LectureFormat,
  type LectureLevel,
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

const empty: Omit<AdminLecture, 'id' | 'updatedAt'> = {
  title: '',
  youtubeUrl: '',
  scholarId: '',
  subjectIds: [],
  description: '',
  series: '',
  format: 'Video',
  level: 'Beginner',
  durationMin: 30,
  episodes: 1,
  status: 'draft',
};

export default function LectureForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { lectures, scholars, subjects, upsertLecture } = useAdmin();
  const existing = id ? lectures.find((l) => l.id === id) : undefined;
  const isNew = !id;

  const [form, setForm] = useState<Omit<AdminLecture, 'id' | 'updatedAt'>>(() =>
    existing
      ? {
          title: existing.title,
          youtubeUrl: existing.youtubeUrl,
          scholarId: existing.scholarId,
          subjectIds: existing.subjectIds,
          description: existing.description,
          series: existing.series,
          format: existing.format,
          level: existing.level,
          durationMin: existing.durationMin,
          episodes: existing.episodes,
          status: existing.status,
        }
      : empty
  );
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

  const save = (status: PublishStatus) => {
    if (!form.title.trim() || !form.youtubeUrl.trim() || !form.scholarId || form.subjectIds.length === 0) {
      setError('Title, YouTube URL, scholar and at least one subject are required.');
      return;
    }
    const item: AdminLecture = {
      id: existing?.id ?? uid('l'),
      ...form,
      title: form.title.trim(),
      youtubeUrl: form.youtubeUrl.trim(),
      description: form.description.trim(),
      series: form.series.trim(),
      status,
      updatedAt: todayStamp(),
    };
    upsertLecture(item, existing ? 'Updated' : 'Added');
    if (status === 'published' && (!existing || existing.status !== 'published')) {
      // already flashed by upsert; fine
    }
    navigate('/admin/lectures');
  };

  return (
    <div className="mx-auto max-w-[760px]">
      <Link to="/admin/lectures" className="text-ink-muted hover:text-rose text-[0.86rem] font-semibold">
        ← Lectures
      </Link>
      <div className="mt-5">
        <PageIntro
          eyebrow={isNew ? 'New lecture' : 'Edit lecture'}
          title={isNew ? 'Add a YouTube lecture' : existing!.title}
          intro="Paste the YouTube URL first. Then name it, attach a scholar and subjects, and publish when it is ready for the library."
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
              label="YouTube URL"
              required
              hint="ilmNet catalogues the talk — the file stays on YouTube."
            >
              <TextInput
                value={form.youtubeUrl}
                onChange={(e) => set('youtubeUrl', e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                inputMode="url"
              />
              <SourcePreview url={form.youtubeUrl} ok={isYoutubeUrl(form.youtubeUrl)} expect="YouTube" />
            </Field>
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
        </section>

        <section className="bg-cream neu-raised space-y-6 rounded-[28px] p-6 sm:p-8">
          <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.2em] uppercase">Classification</p>
          <Field label="Scholar" required hint="Who is teaching. Add a scholar first if they are not in the list.">
            <SelectInput value={form.scholarId} onChange={(e) => set('scholarId', e.target.value)}>
              <option value="">Select a scholar…</option>
              {scholars.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectInput>
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
