import type { ReactNode } from 'react';

export type Tone = 'rose' | 'olive' | 'plain';

export function SearchBar({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /**
   * Accessible name of the field (Fase 5.6.1). A placeholder is a hint, not a name: screen readers
   * announced this input as an unnamed edit field. Every SearchBar now carries an `aria-label` —
   * callers pass a short real label; without one the placeholder text is used, so no call site can
   * end up nameless again.
   */
  label?: string;
}) {
  const accessibleName = label ?? placeholder ?? 'Search';
  return (
    <div className="bg-cream neu-inset flex w-full items-center gap-3 rounded-[22px] px-5 py-3.5">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="text-ink-muted h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.2-3.2" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search…'}
        aria-label={accessibleName}
        className="text-ink placeholder:text-ink-muted w-full bg-transparent text-[0.98rem] outline-none"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="text-ink-muted hover:text-rose transition-colors"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function FilterChips<T extends string>({
  options,
  active,
  onChange,
  allLabel = 'All',
  groupLabel,
}: {
  options: { value: T; label: string }[];
  active: T | 'all';
  onChange: (v: T | 'all') => void;
  allLabel?: string;
  /**
   * Accessible name of the chip row (D2, audit D9). Without it a screen-reader user met a bare
   * "Tafsīr, button" and had to guess what the row filtered on.
   */
  groupLabel?: string;
}) {
  const base =
    'rounded-full px-4 py-2.5 text-[0.88rem] font-semibold tracking-[-0.01em] transition-all duration-300';
  const chip = (selected: boolean) =>
    `${base} ${
      selected ? 'bg-rose text-cream shadow-[7px_9px_20px_rgba(204,58,99,0.28)]' : 'bg-cream text-ink neu-raised-sm hover:-translate-y-0.5'
    }`;
  // D2 (audit D9): `aria-pressed` states whether a chip is on. Before this the only signal was colour.
  return (
    <div className="flex flex-wrap gap-2.5" role="group" aria-label={groupLabel}>
      <button type="button" className={chip(active === 'all')} aria-pressed={active === 'all'} onClick={() => onChange('all')}>
        {allLabel}
      </button>
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          className={chip(active === o.value)}
          aria-pressed={active === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Tag({ children, tone = 'plain' }: { children: ReactNode; tone?: Tone }) {
  const styles =
    tone === 'rose'
      ? 'bg-rose/10 text-rose'
      : tone === 'olive'
        ? 'bg-olive/15 text-olive-deep'
        : 'bg-sand text-ink-soft';
  return (
    <span className={`rounded-full px-3 py-1.5 text-[0.76rem] font-semibold ${styles}`}>{children}</span>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.22em] uppercase">{children}</p>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-cream neu-inset mx-auto max-w-[520px] rounded-[30px] px-8 py-16 text-center">
      <div className="bg-sand neu-raised-sm mx-auto grid h-14 w-14 place-items-center rounded-2xl">
        <svg viewBox="0 0 24 24" className="text-ink-muted h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
        </svg>
      </div>
      <h3 className="font-display text-ink mt-5 text-[1.3rem] font-extrabold tracking-tight">{title}</h3>
      <p className="text-ink-muted mt-2 text-[0.95rem] leading-relaxed">{body}</p>
    </div>
  );
}

export function StatRow({ items }: { items: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-8">
      {items.map((it) => (
        <div key={it.label}>
          <p className="font-display text-ink text-[1.4rem] font-extrabold tracking-tight">{it.value}</p>
          <p className="text-ink-muted mt-1 text-[0.78rem] font-medium tracking-[0.08em] uppercase">{it.label}</p>
        </div>
      ))}
    </div>
  );
}
