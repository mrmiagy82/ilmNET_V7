import { assetUrl } from '@/lib/api';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SearchBar, FilterChips } from '../components/ui';
import { useAdmin } from './store';
import {
  ConfirmDialog,
  CountLine,
  EmptyRow,
  ErrorRow,
  IconBtn,
  LoadingRows,
  PageIntro,
  PencilIcon,
  PrimaryButton,
  StatusPill,
  TableShell,
  TrashIcon,
  statusActions,
  tdCls,
  thCls,
  trCls,
} from './ui';

export default function BooksPage() {
  const { books, scholars, subjects, deleteBook, setBookStatus, loading, backendState, totals } = useAdmin();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [subject, setSubject] = useState<string | 'all'>('all');
  const [source, setSource] = useState<'all' | 'archive' | 'external' | 'google-books' | 'pdf'>('all');
  const [pending, setPending] = useState<string | null>(null);

  const scholarNames = (b: (typeof books)[number]) => {
    const ids = b.scholarIds && b.scholarIds.length ? b.scholarIds : [b.scholarId];
    return ids.map((id) => scholars.find((s) => s.id === id)?.name ?? '—').join(', ');
  };
  const subjectName = (id: string) => subjects.find((s) => s.id === id)?.name ?? id;
  // series is free text; collectionTitle/collectionIdentifier come from a bulk import
  const groupLabel = (b: (typeof books)[number]) => [b.series, b.collectionTitle].filter(Boolean).join(' · ');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter((b) => {
      const names = b.subjectIds.map(subjectName).join(' ');
      const scholarStr = scholarNames(b);
      const url = (b.sourceUrl ?? b.archiveUrl ?? '').toLowerCase();
      const group = `${b.series ?? ''} ${b.collectionTitle ?? ''} ${b.collectionIdentifier ?? ''}`.toLowerCase();
      const matchesQ =
        !q ||
        b.title.toLowerCase().includes(q) ||
        scholarStr.toLowerCase().includes(q) ||
        names.toLowerCase().includes(q) ||
        group.includes(q) ||
        url.includes(q);
      const matchesS = status === 'all' || b.status === status;
      const matchesSub = subject === 'all' || b.subjectIds.includes(subject);
      const sType = b.sourceType ?? 'archive';
      const matchesSrc = source === 'all' || sType === source;
      return matchesQ && matchesS && matchesSub && matchesSrc;
    });
  }, [books, query, status, subject, source, scholars, subjects]);

  const remove = books.find((b) => b.id === pending);

  return (
    <div className="mx-auto max-w-[1080px]">
      <PageIntro
        eyebrow="External text — Archive.org + external"
        title="Books"
        intro="Each book is an externally hosted document — Archive.org, Google Books, direct PDF or any publisher URL — plus metadata. Attach author(s) and subject(s), then publish."
        action={
          <div className="flex flex-col gap-2">
            <PrimaryButton to="/admin/new" tone="olive">Add via guided flow</PrimaryButton>
            <PrimaryButton to="/admin/books/new" tone="sand">Quick add book</PrimaryButton>
          </div>
        }
      />

      <div className="bg-sand/70 neu-inset mt-10 rounded-[28px] p-4 sm:p-5">
        <SearchBar value={query} onChange={setQuery} placeholder="Search title, author, URL… (covers Archive.org, PDFs, Google Books)" />
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
            options={[
              { value: 'archive', label: 'Archive.org' },
              { value: 'external', label: 'External' },
              { value: 'google-books', label: 'Google Books' },
              { value: 'pdf', label: 'PDF' },
            ]}
            active={source}
            onChange={setSource}
            allLabel="All sources"
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
          <CountLine
            n={filtered.length}
            noun="book"
            total={status === 'all' && !query.trim() && subject === 'all' && source === 'all' ? totals?.allBooks : undefined}
          />
        </div>

        {backendState === 'unauthenticated' ? (
          <div className="mt-6">
            <ErrorRow
              title="Not signed in (401)"
              body="The books could not be loaded. Sign in again — nothing was changed."
            />
          </div>
        ) : backendState === 'offline' ? (
          <div className="mt-6">
            <ErrorRow
              title="Backend unreachable"
              body="The book list could not be loaded from the database. Retry once the API responds — this is not an empty library."
            />
          </div>
        ) : loading ? (
          <div className="mt-6">
            <LoadingRows rows={4} label="Loading books from PostgreSQL…" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-6">
            <EmptyRow title="No books match" body="Try another search, subject, source or publish state." />
          </div>
        ) : (
        <>
          <div className="mt-5 space-y-3 lg:hidden">
            {filtered.map((b) => {
              const sType = b.sourceType ?? 'archive';
              return (
                <article key={b.id} className="bg-cream neu-raised rounded-[24px] p-5">
                  <div className="flex gap-3">
                    {b.coverUrl ? (
                      <img src={assetUrl(b.coverUrl)!} alt="" className="h-[86px] w-[62px] shrink-0 rounded-[8px] object-cover bg-sand" />
                    ) : (
                      <span className="bg-sand grid h-[86px] w-[62px] shrink-0 place-items-center rounded-[8px] text-[0.62rem] font-bold text-ink-muted">{b.format.slice(0,4).toUpperCase()}</span>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-1.5">
                        <StatusPill status={b.status} />
                        <span className="bg-olive/15 text-olive-deep rounded-full px-2.5 py-1 text-[0.68rem] font-semibold capitalize">{sType.replace('-', ' ')}</span>
                      </div>
                      <h3 className="font-display text-ink mt-2 text-[1.05rem] leading-snug font-extrabold line-clamp-2">{b.title}</h3>
                      <p className="text-ink-muted mt-1 text-[0.82rem]">{scholarNames(b)}</p>
                    </div>
                  </div>
                  <p className="text-ink-muted mt-3 truncate text-[0.78rem]">{b.sourceUrl ?? b.archiveUrl}</p>
                  <p className="text-ink-muted mt-1 text-[0.72rem]">{[groupLabel(b), b.subjectIds.map(subjectName).join(', '), `${b.pages} pp`, String(b.year)].filter(Boolean).join(' · ')}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to={`/admin/books/${b.id}`} className="bg-sand neu-raised-sm rounded-full px-4 py-2 text-[0.8rem] font-semibold">
                      Edit
                    </Link>
                      {statusActions(b.status, {
                        publish: () => setBookStatus(b.id, 'published'),
                        unpublish: () => setBookStatus(b.id, 'draft'),
                        archive: () => setBookStatus(b.id, 'archived'),
                        restore: () => setBookStatus(b.id, 'draft'),
                      }).map((a) => (
                        <button key={a.key} onClick={a.onClick} className="bg-sand neu-raised-sm rounded-full px-4 py-2 text-[0.8rem] font-semibold">
                          {a.label}
                        </button>
                      ))}
                    <button onClick={() => setPending(b.id)} className="text-rose rounded-full px-4 py-2 text-[0.8rem] font-semibold">
                      Remove
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-5 hidden lg:block">
            <TableShell>
              <table className="w-full min-w-[880px]">
                <thead>
                  <tr className="bg-sand/50">
                    <th className={thCls}>Title</th>
                    <th className={thCls}>Source</th>
                    <th className={thCls}>Author(s)</th>
                    <th className={thCls}>Subjects</th>
                    <th className={thCls}>State</th>
                    <th className={thCls}>Updated</th>
                    <th className={thCls}> </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((b) => {
                    const sType = b.sourceType ?? 'archive';
                    return (
                      <tr key={b.id} className={trCls}>
                        <td className={tdCls}>
                          <div className="flex gap-3">
                            {b.coverUrl ? (
                              <img src={assetUrl(b.coverUrl)!} alt="" className="h-12 w-9 shrink-0 rounded-[6px] object-cover bg-sand" onError={(e) => ((e.target as HTMLImageElement).style.display='none')} />
                            ) : (
                              <span className="bg-sand grid h-12 w-9 shrink-0 place-items-center rounded-[6px] text-[0.58rem] font-bold text-ink-muted">{b.format.slice(0,3).toUpperCase()}</span>
                            )}
                            <div>
                              <p className="font-semibold leading-tight">{b.title}</p>
                              <p className="text-ink-muted mt-0.5 max-w-[260px] truncate text-[0.75rem]">{b.sourceUrl ?? b.archiveUrl}</p>
                              <p className="text-ink-muted text-[0.72rem]">{[groupLabel(b), `${b.pages} pp`, String(b.year), b.publisher || sType].filter(Boolean).join(' · ')}</p>
                            </div>
                          </div>
                        </td>
                        <td className={tdCls}>
                          <span className="bg-sand text-ink-soft rounded-full px-2.5 py-1 text-[0.72rem] font-semibold capitalize">{sType.replace('-',' ')}</span>
                        </td>
                        <td className={`${tdCls} text-ink-soft max-w-[150px] truncate`}>{scholarNames(b)}</td>
                        <td className={`${tdCls} text-ink-soft max-w-[150px] truncate`}>{b.subjectIds.map(subjectName).join(', ')}</td>
                        <td className={tdCls}>
                          <StatusPill status={b.status} />
                        </td>
                        <td className={`${tdCls} text-ink-muted whitespace-nowrap`}>{b.updatedAt}</td>
                        <td className={tdCls}>
                          <div className="flex items-center justify-end gap-1">
                              {statusActions(b.status, {
                                publish: () => setBookStatus(b.id, 'published'),
                                unpublish: () => setBookStatus(b.id, 'draft'),
                                archive: () => setBookStatus(b.id, 'archived'),
                                restore: () => setBookStatus(b.id, 'draft'),
                              }).map((a) => (
                                <button key={a.key} onClick={a.onClick} className="text-ink-muted hover:text-rose px-2 text-[0.78rem] font-semibold">
                                  {a.label}
                                </button>
                              ))}
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
                    );
                  })}
                </tbody>
              </table>
            </TableShell>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(remove)}
        title="Remove this book?"
          body={
            remove
              ? `“${remove.title}” will leave the desk. The external file (${remove.sourceType ?? 'archive'}) is not deleted. The record is removed from the database for good — use Archive instead if you only want to hide it.`
              : ''
          }
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) deleteBook(pending);
          setPending(null);
        }}
      />
    </div>
  );
}
