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
    <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-[0.76rem] font-semibold ${styles}`}>{children}</span>
  );
}

/**
 * The small uppercase kicker above a title.
 *
 * Visual Maturity 1: it takes an optional `tone`, which adds a brand dot next to the words. Four
 * sections in a row all opened with the identical grey kicker, so the page had no way to say "this is
 * the listening shelf" versus "this is the reading shelf" with anything but the heading text. The dot
 * is decorative (screen readers already get the label text) and only ever uses the two brand colours
 * that the section is really about.
 */
export function SectionLabel({
  children,
  tone,
  ground = 'light',
}: {
  children: ReactNode;
  tone?: Tone;
  /**
   * Visual Balance — which surface the label sits on. The default `light` pairing (`text-ink-muted`
   * on cream, measured 3.8:1) is unchanged everywhere. On the deep warm band the same shade measures
   * 3.3:1, so the label steps one shade darker (`text-ink-soft`, 7.7:1) — the band gets its depth
   * without its small type becoming the least legible text on the page.
   */
  ground?: 'light' | 'deep';
}) {
  const dot = tone === 'rose' ? 'bg-rose' : tone === 'olive' ? 'bg-olive' : null;
  return (
    <p
      className={`${ground === 'deep' ? 'text-ink-soft' : 'text-ink-muted'} inline-flex items-center gap-2 text-[0.72rem] font-semibold tracking-[0.22em] uppercase`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />}
      {children}
    </p>
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

/**
 * One chip in a page header's meta slot (Visual UI Polish).
 *
 * Every detail page drew its own chips — `bg-sand`, `bg-cream neu-inset`, `bg-cream/90` — so the same
 * kind of fact looked different from page to page. There are now three deliberate variants:
 *
 *   - `plain` — a quiet fact (language, year, provider): a sand pill, no shadow;
 *   - `inset` — a measured fact pressed into the surface (a real count);
 *   - `strong` — the leading fact of a header (the type of the thing you are looking at).
 */
export function MetaChip({
  children,
  variant = 'plain',
}: {
  children: ReactNode;
  variant?: 'plain' | 'inset' | 'strong';
}) {
  const styles =
    variant === 'strong'
      ? 'bg-cream neu-raised-sm text-ink'
      : variant === 'inset'
        ? 'bg-cream neu-inset-sm text-ink-soft'
        : 'bg-sand text-ink-soft';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.74rem] font-medium ${styles}`}
    >
      {children}
    </span>
  );
}

/**
 * The result line above every list (Visual UI Polish).
 *
 * `/lectures`, `/books`, `/scholars`, `/subjects` and `/search` had five copies of the same sentence
 * with four different markup conventions (audit D8: only two of them announced themselves). The
 * wording stays each page's own — it is a real sentence about a real count — but the styling and the
 * live-region contract are now one definition.
 */
export function ResultCount({ children }: { children: ReactNode }) {
  return (
    <p className="text-ink-muted text-[0.86rem] font-medium" role="status" aria-live="polite">
      {children}
    </p>
  );
}

/**
 * A quiet full-width note inside a page (the honest footnotes: "this is the whole collection", "the
 * source carries no numbering"). One surface, so a caveat never looks like an error and never looks
 * like a call to action.
 */
export function PanelNote({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-cream neu-inset rounded-[22px] px-6 py-5 text-center ${className}`}>
      <p className="text-ink-muted text-[0.82rem] leading-relaxed">{children}</p>
    </div>
  );
}
