import { useMemo, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { usePageMeta } from '../lib/usePageMeta';
import { EmptyState, StatRow } from '../components/ui';
// Discovery step D0/D2/D3: the tiles, the filter panel and the list states are shared components.
import { ScholarTile, TileSkeleton } from '@/components/cards';
import LibraryFilters from '@/components/LibraryFilters';
import { ListErrorCard } from '@/components/ListStates';
import { usePublicScholars, usePublicSubjects } from '@/lib/usePublicReference';

export default function Scholars() {
  usePageMeta({
    title: 'Scholars',
    description:
      'Every item on ilmNet is traced back to its teacher. Open a scholar’s own page — lectures, series and books gathered in one place.',
    path: '/scholars',
  });

  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState<string | 'all'>('all');

  // D3: the hub reads the two reference lists and nothing else. It used to fetch up to 100 contents as
  // well, only to count them in the browser — a count that silently stopped at 100 published records
  // (audit A5) and an extra request nobody needed (audit D10). Every real number now comes from the API
  // lists themselves (scholars, fields) or from a scholar's own page (`pagination.total`).
  const scholars = usePublicScholars({ errorMessage: 'Failed to load scholars' });
  const subjects = usePublicSubjects({ errorMessage: 'Failed to load fields' });

  const fieldOptions = useMemo(
    () => subjects.data.map((s) => ({ value: s.id, label: s.name })),
    [subjects.data],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scholars.data.filter((s) => {
      const field = s.specialty?.name ?? subjects.data.find((sub) => sub.id === s.specialtyId)?.name ?? '';
      const matchesQuery = !q || s.name.toLowerCase().includes(q) || field.toLowerCase().includes(q) || (s.bio ?? '').toLowerCase().includes(q);
      const matchesField = specialty === 'all' || s.specialtyId === specialty;
      return matchesQuery && matchesField;
    });
  }, [scholars.data, subjects.data, query, specialty]);

  const hasActiveFilters = Boolean(query.trim()) || specialty !== 'all';
  const loading = scholars.loading;
  const failed = Boolean(scholars.error);

  function reset() {
    setQuery('');
    setSpecialty('all');
  }

  return (
    <>
      <PageHeader
        eyebrow="Learn From"
        title="Scholars"
        intro="Every item on ilmNet is traced back to its teacher. Open a scholar's own page — lectures, series and books gathered in one place, with the real numbers."
        meta={
          <StatRow
            items={[
              { value: loading || failed ? '—' : `${scholars.total}`, label: 'Scholars' },
              { value: loading || failed ? '—' : `${subjects.total}`, label: 'Fields' },
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
            searchPlaceholder="Search by scholar, field or biography…"
            searchLabel="Search scholars"
            hasActiveFilters={hasActiveFilters}
            onReset={reset}
            activeSummary={
              hasActiveFilters ? (
                <>
                  Filters: {query.trim() ? `“${query.trim()}”` : ''}
                  {specialty !== 'all' ? ` · ${fieldOptions.find((o) => o.value === specialty)?.label ?? ''}` : ''}
                  <span className="text-ink-soft"> — share this URL</span>
                </>
              ) : undefined
            }
            groups={[
              {
                id: 'field',
                label: 'Field',
                options: fieldOptions,
                active: specialty,
                allLabel: 'All fields',
                onChange: (v) => setSpecialty(v as string | 'all'),
              },
            ]}
          />

          {loading ? (
            <>
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium">Loading scholars…</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <TileSkeleton key={i} />
                ))}
              </div>
            </>
          ) : failed ? (
            <ListErrorCard title="Could not load scholars" onRetry={scholars.retry} retrying={loading} />
          ) : (
            <>
              {/* D8: the result line announces itself, so filtering moves no focus and still speaks. */}
              <p className="text-ink-muted mt-8 text-[0.86rem] font-medium" role="status" aria-live="polite">
                {hasActiveFilters ? `${filtered.length} of ${scholars.total} scholars in view` : `${scholars.total} scholars`}
              </p>
              {filtered.length > 0 ? (
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((s) => (
                    // Audit A2: the tile opens the scholar's own page. The numbers live there, where they
                    // are real API totals — a tile could only guess them (see docs/CONTEXT.md §7t).
                    <ScholarTile key={s.id} s={s} to={`/scholars/${encodeURIComponent(s.slug)}`} linkLabel="View work" />
                  ))}
                </div>
              ) : (
                <div className="mt-10">
                  {hasActiveFilters ? (
                    <EmptyState title="No scholars match" body="Try another field, or search part of a name. Clear the filters to see every scholar." />
                  ) : (
                    <EmptyState title="No scholars yet" body="Published scholars appear here as soon as they are added." />
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
