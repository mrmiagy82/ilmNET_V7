/**
 * The filter panel both library shelves use (Discovery step D2).
 *
 * The two pages had the same panel written twice, and the copies disagreed in exactly the places an
 * audit looks for (D6): the same control was called "Format" on `/lectures` and "Edition" on `/books`
 * (audit B3), the subject chips were truncated with a regex on both (B2), and on a phone the panel was a
 * wall of every scholar and every subject pushed under a fixed header (B1).
 *
 * What this component guarantees:
 *   - **one vocabulary.** The caller names its groups; both pages pass "Scholar", "Subject", "Format".
 *   - **search stays visible on every screen.** Only the chip groups collapse below `md`, behind a real
 *     disclosure button with `aria-expanded`/`aria-controls` (audit D9), so a phone user can filter
 *     without scrolling past twelve chips first.
 *   - **the panel reports what is active.** An active-filter summary in words, plus a reset that clears
 *     everything including the search field.
 *   - the chips themselves carry `aria-pressed`, so a screen reader hears which one is on (audit D9).
 */
import { useState, type ReactNode } from 'react';
import { FilterChips, SearchBar } from '@/components/ui';

export type FilterGroup = {
  /** stable id used for the group label association */
  id: string;
  /** group heading, e.g. "Scholar" */
  label: string;
  options: { value: string; label: string }[];
  /** currently selected value, or 'all' */
  active: string;
  allLabel: string;
  onChange: (value: string) => void;
};

export default function LibraryFilters({
  search,
  onSearch,
  searchPlaceholder,
  searchLabel,
  groups,
  activeSummary,
  hasActiveFilters,
  onReset,
}: {
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder: string;
  searchLabel: string;
  groups: FilterGroup[];
  /** the words shown under "Filters: …"; only rendered when filters are active */
  activeSummary?: ReactNode;
  hasActiveFilters: boolean;
  onReset: () => void;
}) {
  const [openOnMobile, setOpenOnMobile] = useState(false);
  const panelId = 'library-filters-panel';
  const activeCount = groups.filter((g) => g.active !== 'all').length;

  return (
    <div className="bg-sand/70 neu-inset sticky top-[88px] z-30 rounded-[34px] p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="lg:flex-1">
          <SearchBar value={search} onChange={onSearch} placeholder={searchPlaceholder} label={searchLabel} />
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={() => setOpenOnMobile((v) => !v)}
            aria-expanded={openOnMobile}
            aria-controls={panelId}
            className="bg-cream text-ink neu-raised-sm inline-flex items-center gap-2 rounded-full px-5 py-3 text-[0.86rem] font-semibold md:hidden"
          >
            Filters
            {activeCount > 0 && (
              <span className="bg-rose text-cream grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[0.7rem] font-bold">{activeCount}</span>
            )}
            <svg viewBox="0 0 24 24" className={`h-4 w-4 transition-transform ${openOnMobile ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="m6 9.5 6 6 6-6" />
            </svg>
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="bg-cream neu-raised-sm text-ink hover:text-rose shrink-0 rounded-full px-5 py-3 text-[0.86rem] font-semibold transition-colors"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      <div id={panelId} className={`${openOnMobile ? 'flex' : 'hidden'} mt-4 flex-col gap-4 md:flex`}>
        {groups.map((group) => (
          <div key={group.id}>
            <p id={`${group.id}-label`} className="text-ink-muted mb-2 text-[0.7rem] font-semibold tracking-[0.14em] uppercase">
              {group.label}
            </p>
            <FilterChips
              options={group.options}
              active={group.active}
              onChange={(v) => group.onChange(v)}
              allLabel={group.allLabel}
              groupLabel={group.label}
            />
          </div>
        ))}
        {hasActiveFilters && activeSummary && <p className="text-ink-muted text-[0.74rem]">{activeSummary}</p>}
      </div>
    </div>
  );
}
