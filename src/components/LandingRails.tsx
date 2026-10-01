/**
 * The landing page's discovery sections (Discovery step D1, recomposed in Visual Maturity 1 and 2).
 *
 * Four sections, each one real API question, each one request, each one hiding itself when the answer
 * is empty or the request fails (plan §9: never a plausible-looking 0, never a mock card):
 *
 *   | Section | Real API question | "Show all" |
 *   | --- | --- | --- |
 *   | New in the library | the whole library, `sort=publishedAt:desc` (no type filter) | — (there is no page that means "everything new"; the newest entry is featured and the rest of the front page follows) |
 *   | Newest lectures | the lectures shelf (`type=lecture,video,audio`), newest first | `/lectures` |
 *   | Newest books | the books shelf (`type=book,document`), newest first | `/books` |
 *   | Scholars | `/api/scholars` — the published scholars themselves | `/scholars` |
 *
 * There is deliberately **no** Popular/Trending/Featured rail: the API has no popularity signal and
 * the plan forbids inventing one (§3.3). Every number comes from the API (`pagination.total` for
 * contents, the returned list length for scholars). Scholar tiles show no counts: counting them would
 * need one request per scholar (the honest server-side counter is B2, still to be decided).
 *
 * ---
 *
 * **Visual Maturity 1** gave each band its own heading composition and a lead entry. **Visual Maturity 2
 * goes further: the three sections no longer share a shape at all.** The review measured that the page
 * was ~80 % cream and that every band was "heading + one horizontal row"; a visitor could not tell the
 * listening shelf from the reading shelf except by the words.
 *
 *   1. **New in the library — the front page.** No rail. The newest entry is a full feature (its real
 *      thumbnail or cover at the largest size the page gives a content item) and the next five follow
 *      as rows in a second column: small real thumbnail, title, teacher, one meta line, hairline
 *      separators. Scale difference is the composition: one thing to look at, five things to scan.
 *      Cream, so it reads as the page itself rather than as a shelf.
 *   2. **Newest lectures — the listening shelf.** The one band that keeps the raised media cards and
 *      the horizontal scroller: this is where the neumorphic language still means "this is a player
 *      you can open". Cream, rose kicker, pill show-all.
 *   3. **Newest books — the reading wall.** A sand band with a *featured book* (one large real cover,
 *      text beside it, asymmetric 5/7 split) above a grid of eight further covers at four across. Flat:
 *      the cover is the only object with depth. This is the page's largest presentation of real covers
 *      and the band least like a rail.
 *   4. **Scholars — the masthead.** A three-column grid of the same flat tiles instead of a horizontal
 *      rail, so more teachers are visible at once and the band reads as a colophon rather than as a
 *      fourth shelf. Cream, and the quietest of the four.
 *
 * Geometry alternates with the surface: 16:10 media → 3:4 cover → monogram disc, and the compositions
 * alternate between split, rail, wall and grid. That is the discovery plan's "geometry rhythm as a
 * navigation aid" (§2.3) applied to the whole page instead of to one row of cards.
 */
import { Link } from 'react-router-dom';
import { useContentQuery } from '@/lib/useContentQuery';
import { usePublicScholars } from '@/lib/usePublicReference';
import { Rail, RAIL_SLOT } from '@/components/Rail';
import {
  CardSkeleton,
  ContentCard,
  FeaturedBook,
  LeadCard,
  ListEntry,
  ScholarTile,
  ShelfBookCard,
  TileSkeleton,
} from '@/components/cards';

/** Items asked per section, and how many of them are shown. */
const RAIL_LIMIT = 12;
const SKELETONS = 4;
/** The front page: one feature + five rows. */
const FRONT_PAGE = 6;
/** The reading wall: one feature + eight covers, two rows of four. */
const WALL = 9;
/** The masthead: two rows of three. */
const MASTHEAD = 6;

/** Page rhythm for a rail band: the house gutter, the house width (inside `Rail`), and less air than a
 *  full marketing section so several rails read as one browse surface. */
const RAIL_BAND = 'relative px-5 py-12 sm:px-6 lg:py-14';

/** The reading wall and the masthead are not rails, so they own their padding. */
const WALL_BAND = 'relative band-sand px-5 py-14 sm:px-6 lg:py-20';
const MASTHEAD_BAND = 'relative px-5 py-12 sm:px-6 lg:py-16';

export function NewInLibrary() {
  const { data, total, loading, shouldHide } = useContentQuery({}, { shelf: 'library', limit: FRONT_PAGE, sort: 'publishedAt:desc' });
  if (shouldHide) return null;
  const [lead, ...rest] = data;
  return (
    <section className={RAIL_BAND} aria-label="New in the library">
      <div className="mx-auto max-w-[1180px]">
        {/* The heading keeps the split composition and the brand hairline it got in Visual Maturity 1;
            what changed is what follows it. */}
        <div className="grid gap-x-10 gap-y-3 lg:grid-cols-[1.15fr_1fr] lg:items-end">
          <div className="min-w-0">
            <p className="text-ink-muted inline-flex items-center gap-2 text-[0.72rem] font-semibold tracking-[0.22em] uppercase">
              <span className="bg-rose h-1.5 w-1.5 rounded-full" aria-hidden="true" />
              Recently added
            </p>
            <h2 className="font-display text-ink mt-2.5 text-[1.45rem] font-extrabold tracking-[-0.03em] text-balance sm:text-[1.62rem]">
              New in the library
            </h2>
          </div>
          <div className="min-w-0 lg:pb-1">
            <p className="text-ink-muted max-w-[46ch] text-[0.9rem] leading-relaxed lg:ml-auto lg:text-right">
              {loading ? 'Loading…' : `${total} ${total === 1 ? 'item' : 'items'} published, newest first. The most recent entry is shown full size, the next few follow as a list.`}
            </p>
          </div>
        </div>
        <div className="hairline-brand mt-5 w-full max-w-[520px]" aria-hidden="true" />

        {loading ? (
          <div className="mt-7 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
            <CardSkeleton media="book" />
            <div className="space-y-4 pt-2">
              {Array.from({ length: SKELETONS }).map((_, i) => (
                <div key={i} className="bg-sand-deep/40 h-[76px] animate-pulse rounded-[12px]" aria-hidden="true" />
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-7 grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-12">
            {lead && <LeadCard c={lead} />}
            <div className="self-start lg:pt-1">
              {rest.map((c) => (
                <ListEntry key={c.id} c={c} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function ListenRail() {
  const { data, total, loading, shouldHide } = useContentQuery({}, { shelf: 'lectures', limit: RAIL_LIMIT, sort: 'publishedAt:desc' });
  if (shouldHide) return null;
  return (
    <Rail
      className={RAIL_BAND}
      bleed
      tone="rose"
      label="Listen"
      title="Newest lectures"
      subtitle={loading ? 'Loading…' : `${total} ${total === 1 ? 'item' : 'items'} to listen`}
      showAll={{ to: '/lectures', label: 'All lectures' }}
      showAllVariant="button"
      items={data.length}
      loading={loading}
      skeletonCount={SKELETONS}
      itemClassName={RAIL_SLOT.media}
    >
      {data.map((c) => (
        <ContentCard key={c.id} c={c} />
      ))}
    </Rail>
  );
}

export function ReadRail() {
  const { data, total, loading, shouldHide } = useContentQuery({}, { shelf: 'books', limit: WALL, sort: 'publishedAt:desc' });
  if (shouldHide) return null;
  const [featured, ...wall] = data;
  return (
    <section className={WALL_BAND} aria-label="Newest books">
      <div className="mx-auto max-w-[1180px]">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="min-w-0">
            <p className="text-ink-muted inline-flex items-center gap-2 text-[0.72rem] font-semibold tracking-[0.22em] uppercase">
              <span className="bg-olive h-1.5 w-1.5 rounded-full" aria-hidden="true" />
              Read
            </p>
            <h2 className="font-display text-ink mt-2.5 text-[1.45rem] font-extrabold tracking-[-0.03em] text-balance sm:text-[1.62rem]">
              Newest books
            </h2>
            <p className="text-ink-muted mt-2 max-w-[62ch] text-[0.85rem]">
              {loading ? 'Loading…' : `${total} ${total === 1 ? 'book' : 'books'} to read — the most recent shown large, then the shelf.`}
            </p>
          </div>
          <Linkish to="/books" label="All books" />
        </div>

        {loading ? (
          <div className="mt-10 grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <CardSkeleton key={i} media="book" />
            ))}
          </div>
        ) : (
          <>
            {featured && (
              <div className="mt-10 border-t border-line/70 pt-10">
                <FeaturedBook c={featured} />
              </div>
            )}
            {wall.length > 0 && (
              <div className="mt-12 grid grid-cols-2 gap-x-5 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
                {wall.map((c, i) => (
                  // On a phone the wall keeps two rows (four covers) so the page does not become an
                  // endless scroll; from `sm` up all eight are shown. The featured book covers the scale
                  // story on every viewport.
                  <div key={c.id} className={i >= 4 ? 'hidden sm:block' : ''}>
                    <ShelfBookCard c={c} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export function ScholarRail() {
  const { data, loading, shouldHide } = usePublicScholars();
  if (shouldHide) return null;
  const shown = data.slice(0, MASTHEAD);
  return (
    <section className={MASTHEAD_BAND} aria-label="Scholars">
      <div className="mx-auto max-w-[1180px]">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="min-w-0">
            <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.22em] uppercase">Learn from</p>
            <h2 className="font-display text-ink mt-2.5 text-[1.45rem] font-extrabold tracking-[-0.03em] text-balance sm:text-[1.62rem]">
              Every lesson has a teacher.
            </h2>
            <p className="text-ink-muted mt-2 max-w-[62ch] text-[0.85rem]">
              {loading ? 'Loading…' : 'Follow a scholar’s work rather than scattered clips'}
            </p>
          </div>
          <Linkish to="/scholars" label="All scholars" />
        </div>

        {loading ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <TileSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((s) => (
              <ScholarTile key={s.id} s={s} to={`/scholars/${encodeURIComponent(s.slug)}`} linkLabel="View work" variant="flat" />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** The "Show all" link in the two sections that are not rails (the `Rail` owns its own copy). */
function Linkish({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="text-rose focus-visible:outline-none shrink-0 text-[0.88rem] font-semibold transition-all inline-flex items-center gap-1.5"
    >
      {label} <span aria-hidden="true">→</span>
    </Link>
  );
}
