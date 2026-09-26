/**
 * Horizontal rail + section heading (Discovery step D0, extended in D1).
 *
 * The building block every discovery section on the landing page, the library pages and the scholar
 * hub uses. It is deliberately boring: a heading, an optional "Show all" link, and a horizontally
 * scrollable row of cards that the existing card components are dropped into.
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
 *
 * D1 additions (all opt-in, so D0 callers are unaffected):
 *   - `bleed` — the rail scrolls to the page gutter and the next card peeks in, while the first card
 *     stays aligned with the heading. It assumes the site's page gutter (`px-5` / `sm:px-6`).
 *   - `align` — `start` lets cards keep their own height (a mixed shelf of covers and media frames);
 *     `stretch` (default) equalises them, which is what the tiles and the single-shape shelves want.
 *   - paging buttons — real `<button>`s with an accessible name, shown from `md` up, measured against
 *     the scroller (they are absent, not merely useless, when the row does not overflow). Touch devices
 *     keep the native swipe; nothing is animated beyond `scroll-behavior: smooth`.
 *
 * It renders no data of its own: counts, emptiness and failure are the caller's (from
 * `useContentQuery`, which hides on failure too).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
  /** extra controls next to the show-all link (the rail's paging buttons) */
  actions?: ReactNode;
  className?: string;
};

export function SectionHeading({ label, title, subtitle, showAll, actions, className = '' }: SectionHeadingProps) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 ${className}`}>
      <div>
        {label && <SectionLabel>{label}</SectionLabel>}
        <h2 className="font-display text-ink mt-2 text-[1.35rem] font-extrabold tracking-[-0.02em]">{title}</h2>
        {subtitle && <p className="text-ink-muted mt-1 text-[0.82rem]">{subtitle}</p>}
      </div>
      {(showAll || actions) && (
        <div className="flex shrink-0 items-center gap-3">
          {actions}
          {showAll && (
            <Link
              to={showAll.to}
              className="text-rose shrink-0 text-[0.86rem] font-semibold transition-all hover:gap-2.5 inline-flex items-center gap-1.5"
            >
              {showAll.label ?? 'Show all'} <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {direction === 'left' ? <path d="m14.5 5.5-6 6.5 6 6.5" /> : <path d="m9.5 5.5 6 6.5-6 6.5" />}
    </svg>
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
  /** scroll all the way to the page gutter so the next card peeks in (assumes `px-5` / `sm:px-6`) */
  bleed?: boolean;
  /** `start` keeps each card at its own height; `stretch` (default) gives them one row height */
  align?: 'start' | 'stretch';
  className?: string;
  children?: ReactNode;
};

/**
 * Card slots for the rails (D2: *one* set of rail widths, so the same kind of card has the same width
 * on the landing page and on a library page). `media` is the 16:10 lecture/series frame, `book` the
 * 3:4 cover frame, `scholar` the tile.
 */
export const RAIL_SLOT = {
  media: 'w-[270px] shrink-0 snap-start sm:w-[330px]',
  book: 'w-[230px] shrink-0 snap-start sm:w-[270px]',
  scholar: 'w-[280px] shrink-0 snap-start sm:w-[320px]',
} as const;

const DEFAULT_ITEM = RAIL_SLOT.scholar;

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
  bleed = false,
  align = 'stretch',
  className = '',
  children,
}: RailProps) {
  const count = items ?? (Array.isArray(children) ? children.length : children ? 1 : 0);
  const showSkeletons = loading && count === 0;
  const scroller = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ canScroll: false, left: false, right: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setScroll({ canScroll: max > 4, left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  }, []);

  // The buttons only exist when the row really overflows, and they follow the live scroll position.
  // A ResizeObserver on the scroller *and* its slots also catches the skeleton → content swap.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    el.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener('scroll', measure);
    };
  }, [measure, count, loading, itemClassName, align]);

  const page = (direction: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(el.clientWidth * 0.85, 280), behavior: 'smooth' });
  };

  if (!alwaysVisible && !showSkeletons && count === 0) return null;

  const name = ariaLabel ?? (typeof title === 'string' ? title : undefined);
  const buttons = scroll.canScroll ? (
    <div className="hidden items-center gap-2 md:flex">
      {([-1, 1] as const).map((direction) => {
        const disabled = direction === -1 ? !scroll.left : !scroll.right;
        return (
          <button
            key={direction}
            type="button"
            onClick={() => page(direction)}
            disabled={disabled}
            aria-label={`${direction === -1 ? 'Scroll left' : 'Scroll right'}${name ? `: ${name}` : ''}`}
            className="bg-cream text-ink neu-raised-sm grid h-9 w-9 place-items-center rounded-full transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
          >
            <ChevronIcon direction={direction === -1 ? 'left' : 'right'} />
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <section className={className}>
      <div className="mx-auto max-w-[1180px]">
        <SectionHeading label={label} title={title} subtitle={subtitle} showAll={showAll} actions={buttons} />
        <div
          ref={scroller}
          role="region"
          aria-label={name}
          tabIndex={0}
          className={`rail-scroll mt-4 flex gap-6 overflow-x-auto overscroll-x-contain scroll-smooth pb-2 focus-visible:outline-none ${
            align === 'start' ? 'items-start' : ''
          } ${bleed ? '-mx-5 scroll-pl-5 px-5 sm:-mx-6 sm:scroll-pl-6 sm:px-6' : ''}`}
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
      </div>
    </section>
  );
}
