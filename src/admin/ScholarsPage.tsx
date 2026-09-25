import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchBar, FilterChips } from '../components/ui';
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

export default function ScholarsPage() {
  const { scholars, subjects, lectures, books, deleteScholar, setScholarStatus } = useAdmin();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [pending, setPending] = useState<string | null>(null);

  const specialty = (id: string) => subjects.find((s) => s.id === id)?.name ?? '—';
  const usedBy = (id: string) =>
    lectures.filter((l) => l.scholarId === id).length + books.filter((b) => b.scholarId === id).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scholars.filter((s) => {
      const matchesQ = !q || s.name.toLowerCase().includes(q) || specialty(s.specialtyId).toLowerCase().includes(q);
      const matchesS = status === 'all' || s.status === status;
      return matchesQ && matchesS;
    });
  }, [scholars, query, status, subjects]);

  const remove = scholars.find((s) => s.id === pending);
  const removeBlocked = remove ? usedBy(remove.id) : 0;

  return (
    <div className="mx-auto max-w-[1080px]">
      <PageIntro
        eyebrow="People"
        title="Scholars"
        intro="Every lecture and book is attached to a scholar. Add the person first, then connect their work from the lecture and book forms."
        action={<PrimaryButton to="/admin/scholars/new">Add scholar</PrimaryButton>}
      />

      <div className="bg-sand/70 neu-inset mt-10 rounded-[28px] p-4 sm:p-5">
        <SearchBar value={query} onChange={setQuery} placeholder="Search by name or field…" />
        <div className="mt-4">
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
        <CountLine n={filtered.length} noun="scholar" />
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyRow title="No scholars match" body="Try another search or publish state." />
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-3 lg:hidden">
            {filtered.map((s) => (
              <article key={s.id} className="bg-cream neu-raised rounded-[24px] p-5">
                <div className="flex items-center gap-3">
                  <div
                    className={`font-display grid h-12 w-12 place-items-center rounded-full text-[0.95rem] font-extrabold neu-inset-sm ${
                      s.accent === 'rose' ? 'bg-rose/10 text-rose' : 'bg-sand text-olive-deep'
                    }`}
                  >
                    {s.initials}
                  </div>
                  <div>
                    <h3 className="font-display text-ink text-[1.05rem] font-extrabold">{s.name}</h3>
                    <p className="text-ink-muted text-[0.8rem]">{specialty(s.specialtyId)}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <StatusPill status={s.status} />
                  <p className="text-ink-muted text-[0.78rem]">{usedBy(s.id)} linked items</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/admin/scholars/${s.id}`} className="bg-sand neu-raised-sm rounded-full px-4 py-2 text-[0.8rem] font-semibold">
                    Edit
                  </Link>
                  <button
                    onClick={() => setScholarStatus(s.id, s.status === 'published' ? 'draft' : 'published')}
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
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="bg-sand/50">
                    <th className={thCls}>Scholar</th>
                    <th className={thCls}>Field</th>
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
                        <div className="flex items-center gap-3">
                          <div
                            className={`font-display grid h-10 w-10 place-items-center rounded-full text-[0.8rem] font-extrabold neu-inset-sm ${
                              s.accent === 'rose' ? 'bg-rose/10 text-rose' : 'bg-sand text-olive-deep'
                            }`}
                          >
                            {s.initials}
                          </div>
                          <span className="font-semibold">{s.name}</span>
                        </div>
                      </td>
                      <td className={`${tdCls} text-ink-soft`}>{specialty(s.specialtyId)}</td>
                      <td className={`${tdCls} text-ink-muted`}>{usedBy(s.id)}</td>
                      <td className={tdCls}>
                        <StatusPill status={s.status} />
                      </td>
                      <td className={`${tdCls} text-ink-muted whitespace-nowrap`}>{s.updatedAt}</td>
                      <td className={tdCls}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setScholarStatus(s.id, s.status === 'published' ? 'draft' : 'published')}
                            className="text-ink-muted hover:text-rose px-2 text-[0.78rem] font-semibold"
                          >
                            {s.status === 'published' ? 'Unpublish' : 'Publish'}
                          </button>
                          <Link
                            to={`/admin/scholars/${s.id}`}
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
        title={removeBlocked ? 'Still connected' : 'Remove this scholar?'}
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
          if (remove && !removeBlocked) deleteScholar(remove.id);
          setPending(null);
        }}
      />
    </div>
  );
}
