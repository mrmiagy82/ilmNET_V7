/**
 * The landing page's discovery rails (Discovery step D1).
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
 */
import { useContentQuery } from '@/lib/useContentQuery';
import { usePublicScholars } from '@/lib/usePublicScholars';
import { Rail } from '@/components/Rail';
import { CardSkeleton, ContentCard, ScholarTile, TileSkeleton } from '@/components/cards';

/** Cards per rail. One page of twelve, the API's own default page size for a discovery row. */
const RAIL_LIMIT = 12;
const SKELETONS = 4;
const MEDIA_SLOT = 'w-[270px] shrink-0 snap-start sm:w-[330px]';
const BOOK_SLOT = 'w-[230px] shrink-0 snap-start sm:w-[270px]';
const SCHOLAR_SLOT = 'w-[280px] shrink-0 snap-start sm:w-[320px]';

/** Page rhythm for a rail band: the house gutter, the house width (inside `Rail`), and less air than a
 *  full marketing section so several rails read as one browse surface. */
const RAIL_BAND = 'relative px-5 py-14 sm:px-6 lg:py-16';

/** "N items" for a rail subtitle — the API's own total, or nothing while it is unknown. */
function itemCount(total: number): string {
  return `${total} ${total === 1 ? 'item' : 'items'}`;
}

export function NewInLibrary() {
  const { data, total, loading, shouldHide } = useContentQuery({}, { shelf: 'library', limit: RAIL_LIMIT, sort: 'publishedAt:desc' });
  if (shouldHide) return null;
  return (
    <Rail
      className={RAIL_BAND}
      bleed
      align="start"
      label="Recently added"
      title="New in the library"
      subtitle={loading ? 'Loading…' : `${itemCount(total)} published, newest first`}
      items={data.length}
      loading={loading}
      skeletonCount={SKELETONS}
      skeleton={<CardSkeleton media="book" />}
      itemClassName={BOOK_SLOT}
    >
      {data.map((c) => (
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
      label="Listen"
      title="Newest lectures"
      subtitle={loading ? 'Loading…' : `${itemCount(total)} to listen`}
      showAll={{ to: '/lectures', label: 'All lectures' }}
      items={data.length}
      loading={loading}
      skeletonCount={SKELETONS}
      itemClassName={MEDIA_SLOT}
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
      className={RAIL_BAND}
      bleed
      label="Read"
      title="Newest books"
      subtitle={loading ? 'Loading…' : `${itemCount(total)} to read`}
      showAll={{ to: '/books', label: 'All books' }}
      items={data.length}
      loading={loading}
      skeletonCount={SKELETONS}
      skeleton={<CardSkeleton media="book" />}
      itemClassName={BOOK_SLOT}
    >
      {data.map((c) => (
        <ContentCard key={c.id} c={c} />
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
      itemClassName={SCHOLAR_SLOT}
    >
      {data.map((s) => (
        <ScholarTile key={s.id} s={s} linkLabel="View lectures" />
      ))}
    </Rail>
  );
}
