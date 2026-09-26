import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import { usePageMeta } from '../lib/usePageMeta';
import { EmptyState, StatRow } from '../components/ui';
import { TileSkeleton } from '@/components/cards';
import LibraryFilters from '@/components/LibraryFilters';
import { ListErrorCard } from '@/components/ListStates';
import { usePublicSubjects } from '@/lib/usePublicReference';
import { subjectGroups } from '../data';
import type { BackendSubject } from '@/lib/api';

/**
 * One subject tile (D3).
 *
 * The tile used to print "N lectures / N books" counted in the browser from a `limit=100` content
 * request — a number that silently stopped at the 100th published record (audit A5). Either a tile
 * needs one counting request per subject, or it shows no number at all; `AGENTS.md` §2 allows exactly
 * these two options ("Public counters come from the API ..., or are not shown at all"), so D3 chose the
 * second and moved the real total to the subject's own page, where it is `pagination.total`.
 */
function SubjectTile({ s }: { s: BackendSubject }) {
  const badge = s.accent === 'rose' ? 'bg-rose text-cream' : s.accent === 'olive' ? 'bg-olive text-[#22251a]' : 'bg-sand text-ink-soft';
  return (
    <article className="bg-cream neu-raised group flex h-full flex-col rounded-[32px] p-7 transition-transform duration-500 hover:-translate-y-1.5">
      <div className="flex items-start justify-between gap-4">
        <div className={`font-display grid h-14 w-14 shrink-0 place-items-center rounded-[18px] text-[1.25rem] font-extrabold neu-raised-sm ${badge}`}>
          {s.name.charAt(0)}
        </div>
        <span className="text-ink-muted text-[0.7rem] font-semibold tracking-[0.16em] uppercase">{s.group}</span>
      </div>

      <h3 className="font-display text-ink mt-5 text-[1.4rem] leading-tight font-extrabold tracking-[-0.03em]">{s.name}</h3>
      <p className="text-ink-soft mt-3 flex-1 text-[0.92rem] leading-relaxed line-clamp-3">{s.description ?? ''}</p>

      <div className="border-line/70 mt-6 flex items-center justify-end border-t pt-5">
        <Link to={`/subjects/${encodeURIComponent(s.slug)}`} className="text-rose inline-flex items-center gap-1.5 text-[0.86rem] font-semibold transition-all group-hover:gap-2.5">
          Explore <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}

export default function Subjects() {
  usePageMeta({
    title: 'Subjects',
    description:
      'Browse the ilmNet library by subject — every lecture, book and series that belongs to a discipline, grouped the way the tradition already is.',
    path: '/subjects',
  });

  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | 'all'>('all');

  // D3: one request for the reference list; the contents are not fetched here at all (audit A5/D10).
  const subjects = usePublicSubjects({ errorMessage: 'Failed to load subjects' });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subjects.data.filter((s) => {
      const matchesGroup = group === 'all' || s.group === group;
      const matchesQuery = !q || s.name.toLowerCase().includes(q) || (s.description ?? '').toLowerCase().includes(q);
      return matchesGroup && matchesQuery;
    });
  }, [subjects.data, query, group]);

  // The groups that really occur in the list — a real number, not a hard-coded category count.
  const groupsInUse = useMemo(() => new Set(subjects.data.map((s) => s.group)).size, [subjects.data]);
  const hasActiveFilters = Boolean(query.trim()) || group !== 'all';
  const loading = subjects.loading;
  const failed = Boolean(subjects.error);

  function reset() {
    setQuery('');
    setGroup('all');
  }

  return (
    <>
      <PageHeader
        eyebrow="Browse by subject"
        title="Subjects"
        intro="Start from what you want to understand. Choose a discipline and ilmNet gathers every lecture, book and series that belongs to it — grouped the way the tradition already is."
        meta={
          <StatRow
            items={[
              { value: loading || failed ? '—' : `${subjects.total}`, label: 'Subjects' },
              { value: loading || failed ? '—' : `${groupsInUse}`, label: 'Groups' },
              { value: 'Free', label: 'Access' },
            ]}
          />
        }
      />

      <section className="px-5 pb-24 sm:px-6 lg:pb-32">
        <div className="mx-auto max-w-[1180px]">
          <LibraryFilters
            search={query}
            onSearch={setQuery}
            searchPlaceholder="Search subjects…"
            searchLabel="Search subjects"
            hasActiveFilters={hasActiveFilters}
            onReset={reset}
            activeSummary={
              hasActiveFilters ? (
                <>
                  Filters: {query.trim() ? `“${query.trim()}”` : ''}
                  {group !== 'all' ? ` · ${group}` : ''}
                  <span className="text-ink-soft"> — share this URL</span>
                </>
              ) : undefined
            }
            groups={[
              {
                id: 'group',
                label: 'Group',
                options: subjectGroups.map((g) => ({ value: g, label: g })),
                active: group,
                allLabel: 'All groups',
                onChange: (v) => setGroup(v as string | 'all'),
              },
            ]}
          />

          {loading ? (
            <>
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium">Loading subjects…</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <TileSkeleton key={i} />
                ))}
              </div>
            </>
          ) : failed ? (
            <ListErrorCard title="Could not load subjects" onRetry={subjects.retry} retrying={loading} />
          ) : (
            <>
              {/* D8: the result line announces itself. */}
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium" role="status" aria-live="polite">
                {hasActiveFilters ? `${filtered.length} of ${subjects.total} subjects in view` : `${subjects.total} subjects`}
              </p>
              {filtered.length > 0 ? (
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((s) => (
                    <SubjectTile key={s.id} s={s} />
                  ))}
                </div>
              ) : (
                <div className="mt-10">
                  {hasActiveFilters ? (
                    <EmptyState title="No subjects match" body="Try another group, or search part of a name. Clear the filters to see every subject." />
                  ) : (
                    <EmptyState title="No subjects yet" body="Subjects appear here as soon as they are created." />
                  )}
                  {hasActiveFilters && (
                    <div className="mt-6 flex justify-center">
                      <button onClick={reset} className="bg-rose text-cream rounded-full px-6 py-3 text-[0.9rem] font-semibold">
                        Clear all filters
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
