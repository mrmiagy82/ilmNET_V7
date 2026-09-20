import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { initialsFrom, todayStamp, uid, type AdminScholar, type PublishStatus } from './data';
import { useAdmin } from './store';
import { ErrorBanner, Field, GhostButton, PageIntro, PrimaryButton, SelectInput, TextArea, TextInput } from './ui';

export default function ScholarForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { scholars, subjects, upsertScholar } = useAdmin();
  const existing = id ? scholars.find((s) => s.id === id) : undefined;
  const isNew = !id;

  const [name, setName] = useState(existing?.name ?? '');
  const [specialtyId, setSpecialtyId] = useState(existing?.specialtyId ?? subjects[0]?.id ?? '');
  const [bio, setBio] = useState(existing?.bio ?? '');
  const [accent, setAccent] = useState<'rose' | 'olive'>(existing?.accent ?? 'olive');
  const [error, setError] = useState<string | null>(null);

  if (id && !existing) {
    return (
      <div className="mx-auto max-w-[720px]">
        <PageIntro eyebrow="Scholars" title="Not found" intro="This scholar is no longer on the desk." />
        <div className="mt-8">
          <GhostButton to="/admin/scholars">Back to scholars</GhostButton>
        </div>
      </div>
    );
  }

  const save = (status: PublishStatus) => {
    if (!name.trim() || !specialtyId) {
      setError('Name and field are required.');
      return;
    }
    const item: AdminScholar = {
      id: existing?.id ?? uid('s'),
      name: name.trim(),
      initials: initialsFrom(name),
      specialtyId,
      bio: bio.trim(),
      accent,
      status,
      updatedAt: todayStamp(),
    };
    upsertScholar(item, existing ? 'Updated' : 'Added');
    navigate('/admin/scholars');
  };

  return (
    <div className="mx-auto max-w-[720px]">
      <Link to="/admin/scholars" className="text-ink-muted hover:text-rose text-[0.86rem] font-semibold">
        ← Scholars
      </Link>
      <div className="mt-5">
        <PageIntro
          eyebrow={isNew ? 'New scholar' : 'Edit scholar'}
          title={isNew ? 'Add a scholar' : existing!.name}
          intro="A scholar is the person lectures and books attach to. Keep the note short — it appears on their public card."
        />
      </div>

      <form
        className="mt-10 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          save(existing?.status ?? 'draft');
        }}
      >
        <ErrorBanner message={error} />
        <Field label="Name" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Shaykh Usman Rahman" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Primary field" required>
            <SelectInput value={specialtyId} onChange={(e) => setSpecialtyId(e.target.value)}>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Mark colour">
            <SelectInput value={accent} onChange={(e) => setAccent(e.target.value as 'rose' | 'olive')}>
              <option value="olive">Olive</option>
              <option value="rose">Rose</option>
            </SelectInput>
          </Field>
        </div>
        <Field label="Short note">
          <TextArea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="One or two sentences on how they teach." />
        </Field>
        <p className="text-ink-muted text-[0.82rem]">
          Initials used on cards: <span className="text-ink font-semibold">{initialsFrom(name) || '—'}</span>
        </p>

        <div className="border-line/80 flex flex-col gap-3 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
          <GhostButton to="/admin/scholars">Cancel</GhostButton>
          <div className="flex flex-col gap-3 sm:flex-row">
            <GhostButton onClick={() => save('draft')}>Save as draft</GhostButton>
            <PrimaryButton onClick={() => save('published')}>Publish</PrimaryButton>
          </div>
        </div>
      </form>
    </div>
  );
}
