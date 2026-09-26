/**
 * Horizontal rail + section heading (Discovery step D0).
 *
 * The building block every discovery section on the landing page, the library pages and the scholar
 * hub will use (steps D1–D4). It is deliberately boring: a heading, an optional "Show all" link, and a
 * horizontally scrollable row of cards that the existing card components are dropped into.
 *
 * Contracts that come from the plan and the UX audit, and that this file enforces so no caller has to
 * remember them:
 *
 *   - **a rail hides itself.** With no items and no loading state it renders nothing at all — never an
 *     empty frame with a plausible-looking "0", and never a mock card (plan §9).
 *   - **no Spotify geometry.** No 6 px / 9999 px radius, no green, no dark canvas: the rail is the
 *     existing ilmNet surface with the existing 30 px card rhythm and the cream/sand palette.
 *   - **keyboard reachable.** The scroller is a named, focusable region, so arrow keys scroll it and a
 *     screen reader announces what it is; every card inside is a normal link, so tab order still works.
 *   - **no dependency and no scroll library.** Native CSS scroll snap plus `overflow-x`, nothing else.
 *     Buttons that page the rail are a later step (D1), when the visual result can be judged in the
 *     browser; D0 ships the structure only.
 *
 * It renders no data of its own: counts, emptiness and failure are the caller's (from
 * `useContentQuery`, which hides on failure too).
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SectionLabel } from '@/components/ui';
import { CardSkeleton } from '@/components/cards';

/** Heading rhythm of the existing library pages (`/lectures`, `/books`) plus an optional show-all. */
export type SectionHeadingProps = {
  /** small uppercase kicker above the title */
  label?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** where "Show all" goes; omitted → no link is rendered */
  showAll?: { to: string; label?: string };
  className?: string;
};

export function SectionHeading({ label, title, subtitle, showAll, className = '' }: SectionHeadingProps) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 ${className}`}>
      <div>
        {label && <SectionLabel>{label}</SectionLabel>}
        <h2 className="font-display text-ink mt-2 text-[1.35rem] font-extrabold tracking-[-0.02em]">{title}</h2>
        {subtitle && <p className="text-ink-muted mt-1 text-[0.82rem]">{subtitle}</p>}
      </div>
      {showAll && (
        <Link
          to={showAll.to}
          className="text-rose shrink-0 text-[0.86rem] font-semibold transition-all hover:gap-2.5 inline-flex items-center gap-1.5"
        >
          {showAll.label ?? 'Show all'} <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}

export type RailProps = {
  title: ReactNode;
  label?: ReactNode;
  subtitle?: ReactNode;
  showAll?: { to: string; label?: string };
  /** number of real children the caller has. 0 + not loading → the whole rail disappears. */
  items?: number;
  loading?: boolean;
  skeletonCount?: number;
  /** override the placeholder card (e.g. a book-shaped one) */
  skeleton?: ReactNode;
  /** card width inside the rail; each child is wrapped in a fixed-width, snap-aligned slot */
  itemClassName?: string;
  /** render the heading even when there is nothing to show (a page's own empty state covers it) */
  alwaysVisible?: boolean;
  /** accessible name of the scrollable region; defaults to the title when it is a string */
  ariaLabel?: string;
  className?: string;
  children?: ReactNode;
};

const DEFAULT_ITEM = 'w-[280px] shrink-0 snap-start sm:w-[320px]';

export function Rail({
  title,
  label,
  subtitle,
  showAll,
  items,
  loading = false,
  skeletonCount = 4,
  skeleton,
  itemClassName = DEFAULT_ITEM,
  alwaysVisible = false,
  ariaLabel,
  className = '',
  children,
}: RailProps) {
  const count = items ?? (Array.isArray(children) ? children.length : children ? 1 : 0);
  const showSkeletons = loading && count === 0;
  if (!alwaysVisible && !showSkeletons && count === 0) return null;

  const name = ariaLabel ?? (typeof title === 'string' ? title : undefined);

  return (
    <section className={className}>
      <SectionHeading label={label} title={title} subtitle={subtitle} showAll={showAll} />
      <div
        role="region"
        aria-label={name}
        tabIndex={0}
        className="rail-scroll mt-4 flex gap-6 overflow-x-auto overscroll-x-contain scroll-smooth pb-2 focus-visible:outline-none"
      >
        {showSkeletons
          ? Array.from({ length: skeletonCount }).map((_, i) => (
              <div key={i} className={itemClassName} aria-hidden="true">
                {skeleton ?? <CardSkeleton />}
              </div>
            ))
          : (Array.isArray(children) ? children : [children]).map((child, i) => (
              <div key={i} className={itemClassName}>
                {child}
              </div>
            ))}
      </div>
    </section>
  );
}
