/**
 * "Continue where you left off" — the device-local rail on the landing page (Discovery step D5).
 *
 * This is the visitor-facing half of `useRecentActivity`; the rail itself is the existing `Rail` with
 * the existing content cards, so it reads as one of the landing's discovery rails rather than as a new
 * kind of component (owner instruction §7: no new visual language, no new card shape).
 *
 * Honesty rules it follows, all of them testable:
 *   - **no rail without local activity.** Nothing remembered on this device means this component renders
 *     `null` — no placeholder, no "sign in", no empty band.
 *   - **nothing is shown before it is verified.** The remembered items are checked against the API
 *     first; while that runs the rail stays invisible, because a card that turned out to be gone would
 *     be a fake result.
 *   - **stale entries do not leave a dead end.** If everything remembered is no longer published, the
 *     rail is gone *and* the visitor is offered the only action that makes sense: wipe the list.
 *   - **the copy says where this comes from** — this browser, this device, nothing sent to ilmNet, no
 *     account (the plan's Q1 answer, owner instruction §1).
 *   - **the clear action sits next to the list it clears**, not in a settings page that does not exist.
 */
import { useRecentActivity } from '@/lib/useLocalActivity';
import { Rail, RAIL_SLOT } from '@/components/Rail';
import { ContentCard } from '@/components/cards';

/** Cards in the rail. Short on purpose: this is "what I had open", not a second library shelf. */
const RAIL_LIMIT = 8;

/** The landing rails' shared band (see `LandingRails.tsx`), so the page rhythm stays as it was. */
const RAIL_BAND = 'relative px-5 py-14 sm:px-6 lg:py-16';

/** The one visible way to wipe the device-local list. Named for screen readers, short on screen. */
function ClearActivityButton({ onClear }: { onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label="Clear local activity on this device"
      className="text-rose font-semibold underline underline-offset-2 hover:opacity-80"
    >
      Clear this list
    </button>
  );
}

export default function ContinueRail() {
  const { items, hasStored, loading, clear } = useRecentActivity(RAIL_LIMIT);

  // Nothing has ever been opened here (or the visitor cleared the list): no rail at all.
  if (!hasStored) return null;
  // Still checking the remembered ids against the library: show nothing rather than a promise.
  if (loading) return null;

  if (items.length === 0) {
    return (
      <section className={RAIL_BAND} aria-label="Continue where you left off">
        <div className="mx-auto max-w-[1180px]">
          <div className="bg-cream neu-raised rounded-[28px] p-8 text-center">
            <p className="font-display text-ink text-[1.05rem] font-bold">Nothing to continue</p>
            <p className="text-ink-soft mx-auto mt-2 max-w-[52ch] text-[0.9rem] leading-relaxed">
              The items this device had open are no longer published in the library.
            </p>
            <div className="mt-5">
              <ClearActivityButton onClear={clear} />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <Rail
      className={RAIL_BAND}
      bleed
      align="start"
      label="On this device"
      title="Continue where you left off."
      subtitle={
        <span>
          Kept in this browser only — nothing is sent to ilmNet. <ClearActivityButton onClear={clear} />
        </span>
      }
      ariaLabel="Continue where you left off"
      items={items.length}
      itemClassName={RAIL_SLOT.media}
    >
      {items.map(({ content }) => (
        <ContentCard key={content.id} c={content} />
      ))}
    </Rail>
  );
}
