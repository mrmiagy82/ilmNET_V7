/**
 * "More like this" on a content detail page (Discovery step D5, plan §8 D5).
 *
 * One real API question, asked through the existing shared query hook: *is there other published work
 * in this subject — or, if this item carries no subject, by this scholar*? Subject first, scholar second
 * (the plan's order): a subject is what a visitor is browsing, a teacher is who they follow.
 *
 * Deliberate limits, because a recommendation rail is the easiest place in a library to start inventing:
 *   - **the current item is never in it.** The API has no "not this id" filter, so the exclusion happens
 *     on the answer — every render, so a stale page cannot leak the item back in.
 *   - **only published records.** `/api/contents` forces `status = published`; there is no path here
 *     that could surface a draft.
 *   - **no ranking claim.** The order is the API's own (`sort` default, newest change first) and the
 *     rail says what it was built from ("Other published items in <subject>"). No "best match", no
 *     "recommended for you", no score — the database has no such signal.
 *   - **it disappears rather than disappoints.** No subject *and* no scholar, a failed request, or an
 *     empty answer after excluding the current item → `null`, not an empty band.
 *   - each shelf only suggests its own kind (books suggest books, lectures suggest lectures) through the
 *     existing shelf mapping, so the rail never mixes a PDF into an audio row.
 *
 * The card components and the `Rail` are the shared ones — this file adds no markup of its own beyond
 * the heading text.
 */
import { useMemo } from 'react';
import { useContentQuery } from '@/lib/useContentQuery';
import { Rail, RAIL_SLOT } from '@/components/Rail';
import { ContentCard, isBookType } from '@/components/cards';
import type { BackendContent } from '@/lib/api';

/** Candidates asked of the API before the current item is removed. */
const CANDIDATES = 12;

/** Cards shown. One row of the existing rail widths, with room for the scroll buttons to matter. */
const SHOWN = 10;

/** The detail page's own band: same gutter and width as every other section of the page. */
const RAIL_BAND = 'relative px-5 pb-24 sm:px-6 lg:pb-32';

export default function MoreLikeThis({ c }: { c: BackendContent }) {
  const subject = c.subjects[0]?.subject;
  const scholar = c.scholars[0]?.scholar;
  const shelf = isBookType(c.type) ? 'books' : 'lectures';

  const bySubject = useContentQuery(
    { subject: subject?.slug },
    { shelf, limit: CANDIDATES, enabled: Boolean(subject) },
  );

  // The scholar fallback is asked for only when the subject question was answered and had nothing to
  // offer: one request when the page can answer from the subject, two only when it really cannot.
  const subjectOthers = useMemo(
    () => bySubject.data.filter((x) => x.id !== c.id),
    [bySubject.data, c.id],
  );
  const subjectAnswered = !bySubject.loading && !bySubject.error && Boolean(subject);
  const useScholar = Boolean(scholar) && subjectAnswered && subjectOthers.length === 0;

  const byScholar = useContentQuery(
    { scholar: scholar?.slug },
    { shelf, limit: CANDIDATES, enabled: useScholar },
  );

  const source = useScholar ? byScholar : bySubject;
  const others = useMemo(() => source.data.filter((x) => x.id !== c.id), [source.data, c.id]);

  // No signal to build a rail from, still loading, failed, or empty → render nothing at all.
  if (!subject && !scholar) return null;
  if (source.error || source.loading || others.length === 0) return null;

  const items = others.slice(0, SHOWN);
  const by = useScholar
    ? `Other published work by ${scholar!.name}`
    : `Other published items in ${subject!.name}`;
  const showAll = useScholar
    ? { to: `/scholars/${encodeURIComponent(scholar!.slug)}`, label: `All work by ${scholar!.name}` }
    : { to: `/subjects/${encodeURIComponent(subject!.slug)}`, label: `All items in ${subject!.name}` };

  return (
    <Rail
      className={RAIL_BAND}
      bleed
      label="Keep exploring"
      title="More like this"
      subtitle={by}
      showAll={showAll}
      ariaLabel="More like this"
      items={items.length}
      itemClassName={isBookType(c.type) ? RAIL_SLOT.book : RAIL_SLOT.media}
    >
      {items.map((item) => (
        <ContentCard key={item.id} c={item} />
      ))}
    </Rail>
  );
}
