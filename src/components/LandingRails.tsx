/**
 * The landing page's discovery rails (Discovery step D1, recomposed in Visual Maturity 1).
 *
 * Four rails, each one real API question, each one request, each one hiding itself when the answer is
 * empty or the request fails (plan §9: never a plausible-looking 0, never a mock card):
 *
 *   | Rail | Real API question | "Show all" |
 *   | --- | --- | --- |
 *   | New in the library | the whole library, `sort=publishedAt:desc` (no type filter) | — (there is no page that means "everything new"; a link would promise a view that does not exist) |
 *   | Newest lectures | the lectures shelf (`type=lecture,video,audio`), newest first | `/lectures` |
 *   | Newest books | the books shelf (`type=book,document`), newest first | `/books` |
 *   | Scholars | `/api/scholars` — the published scholars themselves | `/scholars` |
 *
 * There is deliberately **no** Popular/Trending/Featured rail: the API has no popularity signal and
 * the plan forbids inventing one (§3.3). A series rail needs the collections endpoint (B1) or the
 * labelled interim (B1-alt); both are still open owner decisions (Q2), so D1 does not guess.
 *
 * Every number on these rails comes from the API (`pagination.total` for contents, the returned list
 * length for scholars). Scholar tiles show no counts: counting them would need one request per scholar
 * (the honest server-side counter is B2, still to be decided), and a derived-from-a-window number would
 * under-report — exactly audit A5.
 *
 * ---
 *
 * **Visual Maturity 1 — why this file changed.** Four consecutive bands used to be the same cream
 * surface with the same heading and the same raised card inside it, so the page read as one long list
 * and the neumorphic shadow appeared on everything at once. The data, the requests, the honesty rules
 * and the rail behaviour are untouched; only the *composition* differs now, and each band has one job:
 *
 *   1. **New in the library — the primary band.** One large lead entry (real artwork, the largest on the
 *      page after the hero) followed by the rest at card size: a visitor gets an answer to "where do I
 *      start" instead of twelve equal choices. The kicker carries a rose dot and the heading is split
 *      (title left, explanation right) with the page's single brand hairline under it.
 *   2. **Newest lectures — the listening shelf.** Cream band, raised media cards with the inset frame
 *      and the play affordance: this is where the neumorphic language belongs, and it is the only band
 *      whose show-all is a pill instead of a text link.
 *   3. **Newest books — the reading shelf.** A sand band, flat cards: the real cover is the only object
 *      with depth, the title and author sit on the band itself, and the heading is centered above the
 *      row. Same records, same shelf — a different surface, so the visitor sees a change of material.
 *   4. **Scholars — the tertiary band.** Cream again, but flat sand tiles with quiet monograms: the
 *      lightest surface of the three, because the people behind the library should not compete with the
 *      library itself.
 *
 * Geometry alternates too (book-shaped → media frame → book cover → circular monogram), which is the
 * "geometry rhythm as a navigation aid" the discovery plan transfers from the reference UX (§2.3): a
 * long feed signals a change of content type without a divider.
 */
import { useContentQuery } from '@/lib/useContentQuery';
import { usePublicScholars } from '@/lib/usePublicReference';
import { Rail, RAIL_SLOT } from '@/components/Rail';
import { CardSkeleton, ContentCard, LeadCard, ScholarTile, ShelfBookCard, TileSkeleton } from '@/components/cards';

/** Cards per rail. One page of twelve, the API's own default page size for a discovery row. */
const RAIL_LIMIT = 12;
const SKELETONS = 4;

/** Page rhythm for a rail band: the house gutter, the house width (inside `Rail`), and less air than a
 *  full marketing section so several rails read as one browse surface. */
const RAIL_BAND = 'relative px-5 py-12 sm:px-6 lg:py-14';

/** The reading shelf: the same rhythm on the sand band, with a little more room for the covers. */
const SHELF_BAND = 'relative band-sand px-5 py-14 sm:px-6 lg:py-16';

/** "N items" for a rail subtitle — the API's own total, or nothing while it is unknown. */
function itemCount(total: number): string {
  return `${total} ${total === 1 ? 'item' : 'items'}`;
}

export function NewInLibrary() {
  const { data, total, loading, shouldHide } = useContentQuery({}, { shelf: 'library', limit: RAIL_LIMIT, sort: 'publishedAt:desc' });
  if (shouldHide) return null;
  // The newest record is the band's lead; everything else keeps the card size. Same data, one array.
  const [lead, ...rest] = data;
  return (
    <Rail
      className={RAIL_BAND}
      bleed
      align="start"
      tone="rose"
      rule
      layout="split"
      label="Recently added"
      title="New in the library"
      subtitle={
        loading
          ? 'Loading…'
          : `${itemCount(total)} published, newest first. The most recent entry is shown large, the rest follow it.`
      }
      items={data.length}
      loading={loading}
      skeletonCount={SKELETONS}
      skeleton={<CardSkeleton media="book" />}
      itemClassName={RAIL_SLOT.book}
      lead={lead ? <LeadCard c={lead} /> : undefined}
    >
      {rest.map((c) => (
        <ContentCard key={c.id} c={c} />
      ))}
    </Rail>
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
      subtitle={loading ? 'Loading…' : `${itemCount(total)} to listen`}
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
  const { data, total, loading, shouldHide } = useContentQuery({}, { shelf: 'books', limit: RAIL_LIMIT, sort: 'publishedAt:desc' });
  if (shouldHide) return null;
  return (
    <Rail
      className={SHELF_BAND}
      bleed
      tone="olive"
      layout="centered"
      label="Read"
      title="Newest books"
      subtitle={loading ? 'Loading…' : `${itemCount(total)} to read`}
      showAll={{ to: '/books', label: 'All books' }}
      items={data.length}
      loading={loading}
      skeletonCount={SKELETONS}
      skeleton={<CardSkeleton media="book" />}
      itemClassName={RAIL_SLOT.book}
    >
      {data.map((c) => (
        <ShelfBookCard key={c.id} c={c} />
      ))}
    </Rail>
  );
}

export function ScholarRail() {
  const { data, loading, shouldHide } = usePublicScholars();
  if (shouldHide) return null;
  return (
    <Rail
      className={RAIL_BAND}
      bleed
      label="Learn from"
      title="Every lesson has a teacher."
      subtitle={loading ? 'Loading…' : 'Follow a scholar’s work rather than scattered clips'}
      ariaLabel="Scholars"
      showAll={{ to: '/scholars', label: 'All scholars' }}
      items={data.length}
      loading={loading}
      skeletonCount={SKELETONS}
      skeleton={<TileSkeleton />}
      itemClassName={RAIL_SLOT.scholar}
    >
      {data.map((s) => (
        <ScholarTile key={s.id} s={s} to={`/scholars/${encodeURIComponent(s.slug)}`} linkLabel="View work" variant="flat" />
      ))}
    </Rail>
  );
}
