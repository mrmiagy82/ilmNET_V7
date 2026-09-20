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

export default function BooksPage() {
  const { books, scholars, subjects, deleteBook, setBookStatus } = useAdmin();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'published' | 'draft'>('all');
  const [subject, setSubject] = useState<string | 'all'>('all');
  const [pending, setPending] = useState<string | null>(null);

  const scholarName = (id: string) => scholars.find((s) => s.id === id)?.name ?? '—';
  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? id;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((b) => {
      const names = b.subjectIds.map(subjectName).join(' ');
      const matchesQ =
        !q ||
        b.title.toLowerCase().includes(q) ||
        scholarName(b.scholarId).toLowerCase().includes(q) ||
        names.toLowerCase().includes(q);
      const matchesS = status === 'all' || b.status === status;
      const matchesSub = subject === 'all' || b.subjectIds.includes(subject);
      return matchesQ && matchesS && matchesSub;
    });
  }, [books, query, status, subject, scholars, subjects]);

  const remove = books.find((b) => b.id === pending);

  return (
    <div className="mx-auto max-w-[1080px]">
      <PageIntro
        eyebrow="External text"
        title="Books"
        intro="Each book is an Archive.org URL plus metadata. Attach the author (as a scholar) and subjects, then publish it to the reading shelf."
        action={<PrimaryButton to="/admin/books/new">Add book</PrimaryButton>}
      />

      <div className="bg-sand/70 neu-inset mt-10 rounded-[28px] p-4 sm:p-5">
        <SearchBar value={query} onChange={setQuery} placeholder="Search title or author…" />
        <div className="mt-4 flex flex-col gap-3">
          <FilterChips
            options={[
              { value: 'published', label: 'Published' },
              { value: 'draft', label: 'Draft' },
            ]}
            active={status}
            onChange={setStatus}
            allLabel="All states"
          />
          <FilterChips
            options={subjects.map((s) => ({ value: s.id, label: s.name.replace(/ &.*/, '') }))}
            active={subject}
            onChange={setSubject}
            allLabel="All subjects"
          />
        </div>
      </div>

      <div className="mt-6">
        <CountLine n={filtered.length} noun="book" />
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyRow title="No books match" body="Try another search, subject or publish state." />
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-3 lg:hidden">
            {filtered.map((b) => (
              <article key={b.id} className="bg-cream neu-raised rounded-[24px] p-5">
                <StatusPill status={b.status} />
                <h3 className="font-display text-ink mt-2 text-[1.05rem] leading-snug font-extrabold">{b.title}</h3>
                <p className="text-ink-muted mt-1 text-[0.82rem]">{scholarName(b.scholarId)}</p>
                <p className="text-ink-muted mt-3 truncate text-[0.78rem]">{b.archiveUrl}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/admin/books/${b.id}`} className="bg-sand neu-raised-sm rounded-full px-4 py-2 text-[0.8rem] font-semibold">
                    Edit
                  </Link>
                  <button
                    onClick={() => setBookStatus(b.id, b.status === 'published' ? 'draft' : 'published')}
                    className="bg-sand neu-raised-sm rounded-full px-4 py-2 text-[0.8rem] font-semibold"
                  >
                    {b.status === 'published' ? 'Unpublish' : 'Publish'}
                  </button>
                  <button onClick={() => setPending(b.id)} className="text-rose rounded-full px-4 py-2 text-[0.8rem] font-semibold">
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 hidden lg:block">
            <TableShell>
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr className="bg-sand/50">
                    <th className={thCls}>Title</th>
                    <th className={thCls}>Author</th>
                    <th className={thCls}>Subjects</th>
                    <th className={thCls}>State</th>
                    <th className={thCls}>Updated</th>
                    <th className={thCls}> </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => (
                    <tr key={b.id} className={trCls}>
                      <td className={tdCls}>
                        <p className="font-semibold">{b.title}</p>
                        <p className="text-ink-muted mt-0.5 max-w-[280px] truncate text-[0.75rem]">{b.archiveUrl}</p>
                      </td>
                      <td className={`${tdCls} text-ink-soft`}>{scholarName(b.scholarId)}</td>
                      <td className={`${tdCls} text-ink-soft`}>{b.subjectIds.map(subjectName).join(', ')}</td>
                      <td className={tdCls}>
                        <StatusPill status={b.status} />
                      </td>
                      <td className={`${tdCls} text-ink-muted whitespace-nowrap`}>{b.updatedAt}</td>
                      <td className={tdCls}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setBookStatus(b.id, b.status === 'published' ? 'draft' : 'published')}
                            className="text-ink-muted hover:text-rose px-2 text-[0.78rem] font-semibold"
                          >
                            {b.status === 'published' ? 'Unpublish' : 'Publish'}
                          </button>
                          <Link
                            to={`/admin/books/${b.id}`}
                            aria-label="Edit"
                            className="text-ink-muted hover:bg-sand hover:text-ink grid h-9 w-9 place-items-center rounded-full"
                          >
                            <PencilIcon />
                          </Link>
                          <IconBtn label="Remove" onClick={() => setPending(b.id)}>
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
        title="Remove this book?"
        body={remove ? `“${remove.title}” will leave the desk. The Archive.org file itself is not deleted.` : ''}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) deleteBook(pending);
          setPending(null);
        }}
      />
    </div>
  );
}
