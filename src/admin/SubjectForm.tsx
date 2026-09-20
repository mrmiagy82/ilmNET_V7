import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  subjectGroups,
  todayStamp,
  uid,
  type Accent,
  type AdminSubject,
  type PublishStatus,
  type SubjectGroup,
} from './data';
import { useAdmin } from './store';
import { ErrorBanner, Field, GhostButton, PageIntro, PrimaryButton, SelectInput, TextArea, TextInput } from './ui';

export default function SubjectForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { subjects, upsertSubject } = useAdmin();
  const existing = id ? subjects.find((s) => s.id === id) : undefined;
  const isNew = !id;

  const [name, setName] = useState(existing?.name ?? '');
  const [group, setGroup] = useState<SubjectGroup>(existing?.group ?? 'Practice');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [accent, setAccent] = useState<Accent>(existing?.accent ?? 'plain');
  const [error, setError] = useState<string | null>(null);

  if (id && !existing) {
    return (
      <div className="mx-auto max-w-[720px]">
        <PageIntro eyebrow="Subjects" title="Not found" intro="This subject is no longer on the desk." />
        <div className="mt-8">
          <GhostButton to="/admin/subjects">Back to subjects</GhostButton>
        </div>
      </div>
    );
  }

  const save = (status: PublishStatus) => {
    if (!name.trim()) {
      setError('A subject name is required.');
      return;
    }
    const item: AdminSubject = {
      id: existing?.id ?? uid('sub'),
      name: name.trim(),
      group,
      description: description.trim(),
      accent,
      status,
      updatedAt: todayStamp(),
    };
    upsertSubject(item, existing ? 'Updated' : 'Added');
    navigate('/admin/subjects');
  };

  return (
    <div className="mx-auto max-w-[720px]">
      <Link to="/admin/subjects" className="text-ink-muted hover:text-rose text-[0.86rem] font-semibold">
        ← Subjects
      </Link>
      <div className="mt-5">
        <PageIntro
          eyebrow={isNew ? 'New subject' : 'Edit subject'}
          title={isNew ? 'Add a subject' : existing!.name}
          intro="A subject is a shelf. Lectures and books inherit it when you attach them on their own forms."
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
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Fiqh" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Group">
            <SelectInput value={group} onChange={(e) => setGroup(e.target.value as SubjectGroup)}>
              {subjectGroups.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Accent">
            <SelectInput value={accent} onChange={(e) => setAccent(e.target.value as Accent)}>
              <option value="plain">Plain</option>
              <option value="olive">Olive</option>
              <option value="rose">Rose</option>
            </SelectInput>
          </Field>
        </div>
        <Field label="Short description">
          <TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What belongs on this shelf."
          />
        </Field>

        <div className="border-line/80 flex flex-col gap-3 border-t pt-8 sm:flex-row sm:items-center sm:justify-between">
          <GhostButton to="/admin/subjects">Cancel</GhostButton>
          <div className="flex flex-col gap-3 sm:flex-row">
            <GhostButton onClick={() => save('draft')}>Save as draft</GhostButton>
            <PrimaryButton onClick={() => save('published')}>Publish</PrimaryButton>
          </div>
        </div>
      </form>
    </div>
  );
}
