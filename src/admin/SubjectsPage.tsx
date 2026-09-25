import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchBar, FilterChips } from '../components/ui';
import { subjectGroups } from './data';
import { useAdmin } from './store';
import {
  ConfirmDialog,
  CountLine,
  EmptyRow,
  IconBtn,
  PageIntro,
  PencilIcon,
  PrimaryButton,
  StatusPill,
  TableShell,
  TrashIcon,
  tdCls,
  thCls,
  trCls,
} from './ui';

export default function SubjectsPage() {
  const { subjects, lectures, books, deleteSubject, setSubjectStatus } = useAdmin();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | 'all'>('all');
  const [status, setStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [pending, setPending] = useState<string | null>(null);

  const usedBy = (id: string) =>
    lectures.filter((l) => l.subjectIds.includes(id)).length + books.filter((b) => b.subjectIds.includes(id)).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subjects.filter((s) => {
      const matchesQ = !q || s.name.toLowerCase().includes(q) || s.group.toLowerCase().includes(q);
      const matchesG = group === 'all' || s.group === group;
      const matchesS = status === 'all' || s.status === status;
      return matchesQ && matchesG && matchesS;
    });
  }, [subjects, query, group, status]);

  const remove = subjects.find((s) => s.id === pending);
  const removeBlocked = remove ? usedBy(remove.id) : 0;

  return (
    <div className="mx-auto max-w-[1080px]">
      <PageIntro
        eyebrow="Shelves"
        title="Subjects"
        intro="Subjects are the shelves lectures and books sit on. Create a subject, then attach it when you add content."
        action={<PrimaryButton to="/admin/subjects/new">Add subject</PrimaryButton>}
      />

      <div className="bg-sand/70 neu-inset mt-10 rounded-[28px] p-4 sm:p-5">
        <SearchBar value={query} onChange={setQuery} placeholder="Search subjects…" />
        <div className="mt-4 flex flex-col gap-3">
          <FilterChips
            options={subjectGroups.map((g) => ({ value: g, label: g }))}
            active={group}
            onChange={setGroup}
            allLabel="All groups"
          />
          <FilterChips
            options={[
              { value: 'published', label: 'Published' },
              { value: 'draft', label: 'Draft' },
            ]}
            active={status}
            onChange={setStatus}
            allLabel="All states"
          />
        </div>
      </div>

      <div className="mt-6">
        <CountLine n={filtered.length} noun="subject" />
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyRow title="No subjects match" body="Try another group or search term." />
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-3 lg:hidden">
            {filtered.map((s) => (
              <article key={s.id} className="bg-cream neu-raised rounded-[24px] p-5">
                <p className="text-ink-muted text-[0.7rem] font-semibold tracking-[0.16em] uppercase">{s.group}</p>
                <h3 className="font-display text-ink mt-1 text-[1.1rem] font-extrabold">{s.name}</h3>
                <div className="mt-3 flex items-center justify-between">
                  <StatusPill status={s.status} />
                  <p className="text-ink-muted text-[0.78rem]">{usedBy(s.id)} linked items</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/admin/subjects/${s.id}`} className="bg-sand neu-raised-sm rounded-full px-4 py-2 text-[0.8rem] font-semibold">
                    Edit
                  </Link>
                  <button
                    onClick={() => setSubjectStatus(s.id, s.status === 'published' ? 'draft' : 'published')}
                    className="bg-sand neu-raised-sm rounded-full px-4 py-2 text-[0.8rem] font-semibold"
                  >
                    {s.status === 'published' ? 'Unpublish' : 'Publish'}
                  </button>
                  <button onClick={() => setPending(s.id)} className="text-rose rounded-full px-4 py-2 text-[0.8rem] font-semibold">
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 hidden lg:block">
            <TableShell>
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="bg-sand/50">
                    <th className={thCls}>Subject</th>
                    <th className={thCls}>Group</th>
                    <th className={thCls}>Linked</th>
                    <th className={thCls}>State</th>
                    <th className={thCls}>Updated</th>
                    <th className={thCls}> </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className={trCls}>
                      <td className={tdCls}>
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-ink-muted mt-0.5 max-w-[360px] truncate text-[0.78rem]">{s.description}</p>
                      </td>
                      <td className={`${tdCls} text-ink-soft`}>{s.group}</td>
                      <td className={`${tdCls} text-ink-muted`}>{usedBy(s.id)}</td>
                      <td className={tdCls}>
                        <StatusPill status={s.status} />
                      </td>
                      <td className={`${tdCls} text-ink-muted whitespace-nowrap`}>{s.updatedAt}</td>
                      <td className={tdCls}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSubjectStatus(s.id, s.status === 'published' ? 'draft' : 'published')}
                            className="text-ink-muted hover:text-rose px-2 text-[0.78rem] font-semibold"
                          >
                            {s.status === 'published' ? 'Unpublish' : 'Publish'}
                          </button>
                          <Link
                            to={`/admin/subjects/${s.id}`}
                            aria-label="Edit"
                            className="text-ink-muted hover:bg-sand hover:text-ink grid h-9 w-9 place-items-center rounded-full"
                          >
                            <PencilIcon />
                          </Link>
                          <IconBtn label="Remove" onClick={() => setPending(s.id)}>
                            <TrashIcon />
                          </IconBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(remove)}
        title={removeBlocked ? 'Still connected' : 'Remove this subject?'}
        body={
          removeBlocked
            ? `“${remove?.name}” is attached to ${removeBlocked} lecture or book. Unlink them first.`
            : remove
              ? `“${remove.name}” will be deleted for good — this cannot be undone.`
              : ''
        }
        confirmLabel={removeBlocked ? 'Understood' : 'Delete for good'}
        requirePhrase={removeBlocked ? undefined : remove?.name}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (remove && !removeBlocked) deleteSubject(remove.id);
          setPending(null);
        }}
      />
    </div>
  );
}
