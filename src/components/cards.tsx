/**
 * Shared public content cards (Discovery step D0).
 *
 * These components are the *same markup* that used to live inside `pages/Lectures.tsx`,
 * `pages/Books.tsx`, `pages/SubjectDetail.tsx` and `pages/Scholars.tsx`. D0 moved them here without
 * changing a single class name, element or test id, so every page renders exactly as it did — the
 * point of the extraction is that the discovery rails, the scholar hub and the search page can reuse
 * them instead of growing a fifth and sixth copy (the drift the UX audit measured at B3/B6/D6).
 *
 * Two densities exist because the pages genuinely differ:
 *   - `LectureCard` / `SeriesCard` / `BookCard` / `CollectionCard` — the library cards (large frame,
 *     badges, meta footer);
 *   - `CompactSeriesCard` / `CompactContentCard` — the tighter subject-page cards.
 *
 * Design rules that hold for all of them: ilmNet surfaces (`bg-cream neu-raised`), the existing
 * palette tokens, no invented numbers or badges, and nothing rendered that the API did not send.
 */
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import MediaThumb from '@/components/MediaThumb';
import { Tag, type Tone } from '@/components/ui';
import { formatDuration } from '@/data';
import { resolveCardMedia, resolveCover, resolveThumbnail } from '@/lib/thumbnail';
import type { BackendContent, BackendScholar, BackendSubject } from '@/lib/api';
import type { SeriesGroup } from '@/lib/series';

/** Accent values come from the API as free strings; the UI only knows three tones. */
function toneOf(accent: string | null | undefined): Tone {
  return accent === 'rose' || accent === 'olive' ? accent : 'plain';
}

export function PlayGlyph({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 5.6c0-.9 1-1.5 1.8-1l8.1 5.1a1.2 1.2 0 0 1 0 2L9.8 17c-.8.5-1.8-.1-1.8-1V5.6Z" />
    </svg>
  );
}

/** The library card frame: one shelf rhythm shared by every large card. */
function CardShell({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="bg-cream neu-raised lift group flex h-full flex-col rounded-[30px] p-6">
      {children}
    </Link>
  );
}

/**
 * The flat chip that sits **on top of real imagery** (Visual Maturity 1).
 *
 * Every badge, type label and provider pill used to be `bg-cream neu-raised-sm`: a soft white highlight
 * over a photograph, where a highlight cannot exist. Six such pills per card also flattened the depth
 * language — if everything is raised, nothing is. They are now flat cream labels with a hairline rim,
 * so the artwork keeps the depth and the single raised element inside a media frame is the play
 * affordance: the thing you can actually press.
 *
 * The rim (not a shadow) is what keeps the label legible on a light cover; `backdrop-blur` is a
 * two-line-safe softening, not a glassmorphism effect.
 */
export function MediaChip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`bg-cream/95 text-ink border-line/80 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[0.7rem] font-semibold backdrop-blur-[2px] ${className}`}
    >
      {children}
    </span>
  );
}

/** A lecture, talk or single audio/video item. */
export function LectureCard({ c }: { c: BackendContent }) {
  const subj = c.subjects[0]?.subject;
  const scholarName = c.scholars[0]?.scholar?.name ?? 'Unknown scholar';
  const isVideo = c.type === 'video' || c.type === 'lecture';
  const format: 'Audio' | 'Video' = c.type === 'audio' ? 'Audio' : 'Video';
  const media = resolveThumbnail(c);
  const thumb = media.src;
  return (
    <CardShell to={`/lectures/${c.slug}`}>
      <MediaThumb
        src={thumb}
        kind={media.kind}
        testId="lecture-card-thumb"
        className="bg-sand neu-inset aspect-[16/10] rounded-[22px]"
        fallback={
          <div className="absolute inset-x-0 bottom-0 flex h-12 items-end gap-[3px] px-5 pb-3 opacity-40">
            {Array.from({ length: 28 }).map((_, i) => (
              <span key={i} style={{ height: `${12 + ((i * 13) % 60)}%` }} className={i % 3 === 0 ? 'bg-rose/50 flex-1 rounded-full' : 'bg-olive/40 flex-1 rounded-full'} />
            ))}
          </div>
        }
      >
        <div className="absolute inset-0 grid place-items-center">
          <span className="bg-cream neu-raised-sm text-rose group-hover:scale-[1.06] grid h-16 w-16 place-items-center rounded-full transition-transform">
            <PlayGlyph className="h-7 w-7" />
          </span>
        </div>
        <MediaChip className="absolute right-3 top-3">{format}</MediaChip>
        {c.provider === 'youtube' && (
          <MediaChip className="absolute left-3 top-3">
            <span className="bg-rose h-1.5 w-1.5 rounded-full" aria-hidden="true" />
            YouTube
          </MediaChip>
        )}
        {c.provider === 'archive' && (
          <MediaChip className="absolute left-3 top-3">
            <span className="bg-olive h-1.5 w-1.5 rounded-full" aria-hidden="true" />
            Archive
          </MediaChip>
        )}
      </MediaThumb>

      <div className="flex flex-1 flex-col px-1 pt-5">
        <div className="flex items-center gap-2 flex-wrap">
          {subj && <Tag tone={toneOf(subj.accent)}>{subj.name}</Tag>}
          <Tag tone="plain">{isVideo ? 'Video' : 'Audio'}</Tag>
          {c.language && <span className="bg-sand text-ink-soft rounded-full px-2.5 py-1 text-[0.7rem] font-medium">{c.language}</span>}
        </div>
        <h3 className="font-display text-ink mt-3 text-[1.18rem] leading-snug font-extrabold tracking-[-0.02em] line-clamp-2">
          {c.title}
        </h3>
        <span className="text-rose mt-2 text-[0.9rem] font-semibold line-clamp-1">
          {scholarName}
        </span>
        <p className="text-ink-soft mt-3 text-[0.86rem] leading-relaxed line-clamp-2">
          {c.series ? `${c.series} · ` : ''}{c.episodes ? `${c.episodes} episodes` : c.description ? (c.description.slice(0, 80) + (c.description.length > 80 ? '…' : '')) : ''}
        </p>

        <div className="border-line/70 mt-5 flex items-center justify-between border-t pt-4 text-[0.8rem]">
          <span className="text-ink-soft font-medium">{c.durationMin ? formatDuration(c.durationMin) + ' / ep' : c.year ? `${c.year}` : '—'}</span>
          <span className="text-ink-muted">{c.provider === 'youtube' ? 'Watch' : c.provider === 'archive' ? 'Archive' : ''}</span>
        </div>
      </div>
    </CardShell>
  );
}

/**
 * A series / playlist group as shown on the lectures shelf.
 *
 * D6 (audit A4/A5): a card groups whatever the *current view* has loaded, so `s.count` is "items of this
 * collection in this view" — never the size of the collection. The card used to say "3 episodes" and
 * "3 parts" for a collection that might hold thirty (the API has no per-collection count; only the
 * collection page itself, which pages the real total). The label now names its scope, the type badge
 * carries no number, and the "episodes" wording is gone because a collection can also hold books.
 */
export function SeriesCard({ s }: { s: SeriesGroup }) {
  const thumb = s.items[0] ? resolveThumbnail(s.items[0]).src : s.thumbnailUrl;
  const subtitle = s.scholars[0]?.name ?? s.items[0]?.scholars[0]?.scholar.name ?? '';
  const subj = s.subjects[0];
  const isPlaylist = s.type === 'playlist';
  return (
    <CardShell to={`/series/${encodeURIComponent(s.id)}`}>
      <MediaThumb
        src={thumb}
        kind={s.items[0] ? resolveThumbnail(s.items[0]).kind : 'placeholder-generic'}
        testId="series-card-thumb"
        className="bg-sand neu-inset aspect-[16/10] rounded-[22px]"
        fallback={<div className="absolute inset-0 bg-gradient-to-br from-olive/20 to-rose/20" />}
      >
        <MediaChip className="absolute left-3 top-3">
          <span className={`h-2 w-2 rounded-full ${isPlaylist ? 'bg-rose' : 'bg-olive'}`} />
          {/* Type only: the number of items *loaded in this view* is not the size of the collection. */}
          <span className="text-[0.7rem] font-bold tracking-[0.08em] uppercase">{isPlaylist ? 'Playlist' : s.type === 'collection' ? 'Collection' : 'Series'}</span>
        </MediaChip>
        <MediaChip className="absolute right-3 top-3">
          <span className={`h-1.5 w-1.5 rounded-full ${isPlaylist ? 'bg-rose' : 'bg-olive'}`} aria-hidden="true" />
          {s.provider === 'youtube' ? 'YouTube' : s.provider === 'archive' ? 'Archive' : s.provider}
        </MediaChip>
        {/* The one raised element in the frame: it is the affordance that opens the series. */}
        <div className="bg-cream neu-raised-sm text-ink absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-[14px] px-4 py-3">
          <span className="text-[0.78rem] font-semibold">{s.count} in this view</span>
          <span className="text-rose text-[0.78rem] font-bold">Open series →</span>
        </div>
      </MediaThumb>
      <div className="flex flex-1 flex-col px-1 pt-5">
        <div className="flex items-center gap-2 flex-wrap">
          {subj && <Tag tone={toneOf(subj.accent)}>{subj.name}</Tag>}
          <Tag tone={isPlaylist ? 'rose' : 'olive'}>{isPlaylist ? 'YouTube Series' : 'Archive Collection'}</Tag>
        </div>
        <h3 className="font-display text-ink mt-3 text-[1.22rem] leading-snug font-extrabold tracking-[-0.02em] line-clamp-2">
          {s.title}
        </h3>
        {subtitle && <span className="text-rose mt-2 text-[0.9rem] font-semibold line-clamp-1">{subtitle}</span>}
        <p className="text-ink-soft mt-3 text-[0.86rem] leading-relaxed line-clamp-2">
          {s.description ?? 'Open the collection to see everything it contains.'}
        </p>
        <div className="border-line/70 mt-5 flex items-center justify-between border-t pt-4 text-[0.8rem]">
          <span className="text-ink-soft font-medium">{s.scholars.length ? `${s.scholars.length} ${s.scholars.length === 1 ? 'scholar' : 'scholars'}` : ''}</span>
          <span className="text-ink-muted">{s.provider === 'youtube' ? 'YouTube' : 'Archive'}</span>
        </div>
      </div>
    </CardShell>
  );
}

/**
 * The generated spine shown when a book has no usable cover (never a fake cover image).
 *
 * Visual Maturity 1 split the spine out of `BookCover` so the flat shelf card can show the same object;
 * the markup is unchanged.
 */
export function BookSpine({ c, size = 'card' }: { c: BackendContent; size?: 'card' | 'large' }) {
  const subj = c.subjects[0]?.subject;
  const cover = subj?.accent === 'rose' ? 'from-rose/85 to-rose-deep' : subj?.accent === 'olive' ? 'from-olive to-olive-deep' : 'from-ink/80 to-ink';
  // Visual Maturity 2: the spine scales with the plate it stands in. On the reading wall the covers are
  // twice the size of a card's, so a fixed 112 px spine would look like a stamp on a large surface.
  const large = size === 'large';
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className={`relative overflow-hidden rounded-[8px] bg-gradient-to-br ${cover} shadow-[10px_14px_26px_rgba(60,45,30,0.28)] ${large ? 'h-[74%] w-[62%] max-h-[300px] max-w-[210px]' : 'h-[150px] w-[112px]'}`}>
        <div className="absolute inset-y-0 left-0 w-2.5 bg-black/20" />
        <div className="absolute inset-y-0 left-2.5 w-1 bg-white/25" />
        <div className={`flex h-full flex-col justify-between ${large ? 'p-4 pl-6' : 'p-3 pl-4'}`}>
          <span className={`text-cream/80 font-semibold uppercase tracking-[0.14em] ${large ? 'text-[0.68rem]' : 'text-[0.6rem]'}`}>{c.type === 'document' ? 'Document' : 'Book'}</span>
          <div>
            <p className={`font-display text-cream leading-tight font-extrabold line-clamp-3 ${large ? 'text-[1.15rem]' : 'text-[0.92rem]'}`}>{c.title}</p>
            <p className={`text-cream/70 mt-1 line-clamp-1 ${large ? 'text-[0.74rem]' : 'text-[0.66rem]'}`}>{c.scholars[0]?.scholar?.name ?? ''}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BookCover({ c }: { c: BackendContent }) {
  const media = resolveCover(c);
  return (
    <MediaThumb
      src={media.src}
      kind={media.kind}
      testId="book-cover"
      className="bg-sand neu-inset aspect-[3/4] rounded-[22px]"
      fallback={<BookSpine c={c} />}
    />
  );
}

/** A single book or document. */
export function BookCard({ c }: { c: BackendContent }) {
  const subj = c.subjects[0]?.subject;
  const author = c.scholars[0]?.scholar?.name ?? 'Unknown';
  return (
    <CardShell to={`/books/${c.slug}`}>
      <BookCover c={c} />
      <div className="flex flex-1 flex-col px-1 pt-5">
        {subj && <Tag tone={toneOf(subj.accent)}>{subj.name}</Tag>}
        <h3 className="font-display text-ink mt-3 text-[1.18rem] leading-snug font-extrabold tracking-[-0.02em] line-clamp-2">
          {c.title}
        </h3>
        <span className="text-rose mt-1.5 text-[0.9rem] font-semibold line-clamp-1">
          {author}
        </span>
        <p className="text-ink-soft mt-3 text-[0.88rem] leading-relaxed line-clamp-3">{c.description ?? ''}</p>
        <div className="border-line/70 mt-5 flex items-center justify-between border-t pt-4 text-[0.8rem]">
          <span className="text-ink-soft font-medium">{c.pages ? `${c.pages} pages` : c.type === 'document' ? 'Document' : 'Book'}</span>
          <span className="text-ink-muted">{c.year ?? ''}</span>
        </div>
      </div>
    </CardShell>
  );
}

/** An Archive.org collection / book group as shown on the books shelf. */
export function CollectionCard({ s }: { s: SeriesGroup }) {
  const subj = s.subjects[0];
  const first = s.items[0];
  const collectionCover = first ? resolveCover(first).src : s.coverUrl;
  return (
    <CardShell to={`/series/${encodeURIComponent(s.id)}`}>
      <MediaThumb
        src={collectionCover}
        testId="collection-cover"
        className="bg-sand neu-inset aspect-[3/4] rounded-[22px]"
        fallback={<div className="bg-gradient-to-br from-olive/20 to-rose/20 absolute inset-0" />}
      >
        <MediaChip className="absolute left-3 top-3">
          <span className="bg-olive h-2 w-2 rounded-full" />
          <span className="text-[0.7rem] font-bold tracking-[0.08em] uppercase">Collection</span>
        </MediaChip>
        <MediaChip className="bg-olive/90 text-cream border-olive absolute right-3 top-3">Archive</MediaChip>
        <div className="bg-cream neu-raised-sm text-ink absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-[14px] px-4 py-3">
          <span className="text-[0.78rem] font-semibold">{s.count} in this view</span>
          <span className="text-rose text-[0.78rem] font-bold">Open collection →</span>
        </div>
      </MediaThumb>
      <div className="flex flex-1 flex-col px-1 pt-5">
        {subj && <Tag tone={toneOf(subj.accent)}>{subj.name}</Tag>}
        <h3 className="font-display text-ink mt-3 text-[1.18rem] leading-snug font-extrabold tracking-[-0.02em] line-clamp-2">
          {s.title}
        </h3>
        <p className="text-ink-soft mt-3 text-[0.88rem] line-clamp-3">{s.description ?? 'Open the collection to see everything it contains.'}</p>
        <div className="border-line/70 mt-5 flex items-center justify-between border-t pt-4 text-[0.8rem]">
          <span className="text-ink-soft font-medium">{s.scholars[0]?.name ?? 'Collection'}</span>
          <span className="text-ink-muted">{s.provider}</span>
        </div>
      </div>
    </CardShell>
  );
}

/** The tighter series card used inside a subject page. */
export function CompactSeriesCard({ s }: { s: SeriesGroup }) {
  const media = s.items[0] ? resolveCardMedia(s.items[0]) : { src: null, kind: 'placeholder-generic' as const };
  const thumb = media.src;
  return (
    <Link to={`/series/${encodeURIComponent(s.id)}`} className="bg-cream neu-raised lift group flex h-full flex-col rounded-[30px] p-6">
      <MediaThumb
        src={thumb}
        kind={media.kind}
        testId="subject-series-thumb"
        className="bg-sand neu-inset aspect-[16/10] rounded-[22px]"
        fallback={<div className="absolute inset-0 bg-gradient-to-br from-olive/15 to-rose/15" />}
      >
        <MediaChip className="absolute left-3 top-3 font-bold">Series</MediaChip>
        <span className="bg-cream neu-raised-sm absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-[12px] px-3 py-2 text-[0.76rem] font-semibold">
          <span>{s.count} in this view</span><span className="text-rose">Open →</span>
        </span>
      </MediaThumb>
      <h3 className="font-display text-ink mt-4 line-clamp-2 text-[1.1rem] font-extrabold">{s.title}</h3>
      <p className="text-ink-soft mt-2 line-clamp-2 text-[0.84rem] leading-relaxed">{s.description ?? 'Open the series to see everything it contains.'}</p>
    </Link>
  );
}

/** The tighter content card used inside a subject page. */
export function CompactContentCard({ c }: { c: BackendContent }) {
  const isBook = c.type === 'book' || c.type === 'document';
  const media = resolveCardMedia(c);
  const thumb = media.src;
  return (
    <Link to={`/${isBook ? 'books' : 'lectures'}/${c.slug}`} className="bg-cream neu-raised lift group flex h-full flex-col rounded-[30px] p-6">
      <MediaThumb
        src={thumb}
        kind={media.kind}
        testId="subject-content-thumb"
        className={`bg-sand neu-inset rounded-[22px] ${isBook ? 'aspect-[3/4]' : 'aspect-[16/10]'}`}
        fallback={<div className="absolute inset-0 bg-gradient-to-br from-sand to-cream" />}
      >
        <MediaChip className="absolute right-3 top-3">{isBook ? 'Book' : c.type === 'audio' ? 'Audio' : 'Video'}</MediaChip>
      </MediaThumb>
      <h3 className="font-display text-ink mt-4 line-clamp-2 text-[1.05rem] font-bold">{c.title}</h3>
      <p className="text-ink-soft mt-2 line-clamp-2 text-[0.84rem] leading-relaxed">{c.description?.slice(0, 80) ?? ''}</p>
    </Link>
  );
}

/** True for the two book-shelf types. One definition, so a mixed shelf and a card cannot disagree. */
export function isBookType(type: BackendContent['type']): boolean {
  return type === 'book' || type === 'document';
}

/**
 * The card for a record whose shelf is not known in advance (D1: the landing's "new in the library"
 * rail, which mixes every published type). It chooses between the two existing library cards — no new
 * markup, no third card design: books and documents get the cover card, lectures/videos/audio the
 * media card. That alternation is the geometry rhythm the discovery plan asks for (§2.3).
 */
export function ContentCard({ c }: { c: BackendContent }) {
  return isBookType(c.type) ? <BookCard c={c} /> : <LectureCard c={c} />;
}

/**
 * The lead card of the landing's "New in the library" band (Visual Maturity 1).
 *
 * Same record, same fields, same destination as `ContentCard` — only the composition differs, and that
 * is the whole point: twelve equal cards in a row answer "what is here?", but nothing on the page told
 * a visitor where to start. The first item of the mixed shelf is now presented once, large, with the
 * real thumbnail or cover at the largest size the page has outside the hero.
 *
 * Honesty is unchanged: it renders exactly the fields the API returned (never an invented episode
 * number, duration, page count or play state), it is the same `<Link>` the small card is, and a book is
 * still a book — its cover is shown contained on a sand plate instead of being cropped to fill a frame.
 */
export function LeadCard({ c }: { c: BackendContent }) {
  const isBook = isBookType(c.type);
  const subj = c.subjects[0]?.subject;
  const person = c.scholars[0]?.scholar?.name ?? '';
  const media = isBook ? resolveCover(c) : resolveThumbnail(c);
  const kindLabel = isBook ? (c.type === 'document' ? 'Document' : 'Book') : c.type === 'audio' ? 'Audio' : 'Video';

  return (
    <Link
      to={`/${isBook ? 'books' : 'lectures'}/${c.slug}`}
      className={`bg-cream neu-raised lift group grid h-full overflow-hidden rounded-[30px] ${
        // A book keeps a portrait frame (its cover is 3:4 and the text deserves the wider column); a
        // lecture/audio entry gets the media-weighted split the page uses for moving pictures.
        isBook ? 'sm:grid-cols-[0.66fr_1fr]' : 'sm:grid-cols-[1.02fr_1fr]'
      }`}
    >
      {/* Real artwork, larger than anywhere else on the page. A book keeps its own proportions. */}
      <MediaThumb
        src={media.src}
        kind={media.kind}
        testId="lead-card-thumb"
        className="bg-sand-deep/40 relative aspect-[16/10] sm:aspect-auto sm:h-full"
        imgClassName={isBook ? 'object-contain p-6 sm:p-8' : 'object-cover'}
        fallback={isBook ? <BookSpine c={c} /> : <div className="absolute inset-0 bg-gradient-to-br from-olive/20 to-rose/20" />}
      >
        {!isBook && (
          <div className="absolute inset-0 grid place-items-center">
            <span className="bg-cream neu-raised-sm text-rose group-hover:scale-[1.06] grid h-16 w-16 place-items-center rounded-full transition-transform">
              <PlayGlyph className="h-7 w-7" />
            </span>
          </div>
        )}
        <MediaChip className="absolute left-3 top-3">
          <span className={`h-1.5 w-1.5 rounded-full ${c.provider === 'youtube' ? 'bg-rose' : 'bg-olive'}`} aria-hidden="true" />
          {kindLabel}
        </MediaChip>
      </MediaThumb>

      <div className="flex min-w-0 flex-col p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          {subj && <Tag tone={toneOf(subj.accent)}>{subj.name}</Tag>}
          {c.language && <Tag>{c.language}</Tag>}
        </div>
        <h3 className="font-display text-ink mt-4 text-[1.5rem] leading-[1.08] font-extrabold tracking-[-0.035em] line-clamp-3 sm:text-[1.95rem]">
          {c.title}
        </h3>
        {person && <span className="text-rose mt-3 text-[0.95rem] font-semibold line-clamp-1">{person}</span>}
        {c.description && (
          <p className="text-ink-soft mt-3 text-[0.92rem] leading-relaxed line-clamp-3">{c.description}</p>
        )}
        <div className="border-line/70 mt-auto flex items-center justify-between gap-4 border-t pt-4 text-[0.82rem]">
          <span className="text-ink-soft font-medium">
            {isBook
              ? c.pages
                ? `${c.pages} pages`
                : kindLabel
              : c.durationMin
                ? `${formatDuration(c.durationMin)} / ep`
                : c.year
                  ? `${c.year}`
                  : kindLabel}
          </span>
          <span className="text-rose inline-flex items-center gap-1.5 font-semibold">
            Open {isBook ? 'book' : 'lecture'} <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

/**
 * The flat cover card of the landing's reading shelf (Visual Maturity 1).
 *
 * The deliberate counterpart of the raised media card: here the *cover* is the only object with depth
 * (`cover-edge`) and the title, author and meta sit on the sand band itself. No card shell, no inset
 * frame around the artwork, no chip on top of it — a book on a shelf, not a thumbnail in a box. It is
 * the same `<Link>`, the same real cover (custom upload → provider cover → generated spine) and the same
 * honest fields as `BookCard`; on the shelf a book simply gets more artwork and less furniture.
 */
export function ShelfBookCard({ c }: { c: BackendContent }) {
  const subj = c.subjects[0]?.subject;
  const author = c.scholars[0]?.scholar?.name ?? '';
  const media = resolveCover(c);
  return (
    <Link to={`/books/${c.slug}`} className="lift group flex h-full flex-col">
      <MediaThumb
        src={media.src}
        kind={media.kind}
        testId="shelf-cover"
        className="bg-sand-deep/60 cover-edge aspect-[3/4] rounded-[14px]"
        fallback={<BookSpine c={c} size="large" />}
      />
      <div className="flex flex-1 flex-col pt-4">
        <h3 className="font-display text-ink text-[1.02rem] leading-snug font-extrabold tracking-[-0.02em] line-clamp-2">
          {c.title}
        </h3>
        {author && <span className="text-ink-soft mt-1.5 text-[0.85rem] line-clamp-1">{author}</span>}
        <div className="text-ink-muted mt-auto flex items-center gap-2 pt-3 text-[0.78rem] font-medium">
          {subj && <span className="text-olive-deep line-clamp-1">{subj.name}</span>}
          {(c.pages || c.year) && (
            <>
              <span aria-hidden="true">·</span>
              <span>{c.pages ? `${c.pages} pages` : c.year}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * A compact editorial entry in the landing's front-page list (Visual Maturity 2).
 *
 * The "New in the library" band used to be twelve equal cards in a rail. Its newest entry is now a
 * full feature and the next few follow as **rows**: a small real thumbnail, the title, the scholar and
 * one honest meta line, separated by hairlines. No card, no shadow, no rail — the scale difference
 * between the feature and these rows is the point, and a row reads faster than a card when the visitor
 * already knows what the band is about.
 *
 * Everything shown is a field the API returned; a row with a missing thumbnail shows the same
 * placeholder the cards use, never a stand-in image.
 */
export function ListEntry({ c }: { c: BackendContent }) {
  const isBook = isBookType(c.type);
  const media = isBook ? resolveCover(c) : resolveThumbnail(c);
  const person = c.scholars[0]?.scholar?.name ?? '';
  const subj = c.subjects[0]?.subject;
  const meta = isBook
    ? c.pages
      ? `${c.pages} pages`
      : c.type === 'document'
        ? 'Document'
        : 'Book'
    : c.durationMin
      ? `${formatDuration(c.durationMin)} / ep`
      : c.type === 'audio'
        ? 'Audio'
        : c.year
          ? `${c.year}`
          : 'Lecture';
  return (
    <Link
      to={`/${isBook ? 'books' : 'lectures'}/${c.slug}`}
      className="border-line/70 group flex items-center gap-4 border-t py-3.5 first:border-t-0"
    >
      <MediaThumb
        src={media.src}
        kind={media.kind}
        testId="list-entry-thumb"
        className={`bg-sand-deep/60 shrink-0 overflow-hidden rounded-[12px] ${isBook ? 'aspect-[3/4] h-[76px]' : 'aspect-[16/10] w-[100px]'}`}
        imgClassName="object-cover"
        // A row without artwork keeps a neutral mark instead of an empty box — never a stand-in image.
        fallback={
          isBook ? (
            <span className="font-display text-ink/25 grid h-full w-full place-items-center text-[1.3rem] font-extrabold" aria-hidden="true">
              {c.title.charAt(0)}
            </span>
          ) : (
            <span className="text-rose/35 grid h-full w-full place-items-center" aria-hidden="true">
              <PlayGlyph className="h-6 w-6" />
            </span>
          )
        }
      />
      <div className="min-w-0">
        <p className="font-display text-ink text-[1rem] leading-snug font-bold tracking-[-0.02em] line-clamp-2 group-hover:text-rose transition-colors">
          {c.title}
        </p>
        <p className="text-ink-muted mt-1 truncate text-[0.8rem] font-medium">
          {person || subj?.name || ''}
          {person && subj?.name ? ` · ${subj.name}` : ''}
        </p>
        <p className="text-ink-soft mt-0.5 text-[0.78rem]">{meta}</p>
      </div>
      <span className="text-rose ml-auto shrink-0 text-[1.05rem] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true">
        →
      </span>
    </Link>
  );
}

/**
 * The featured book of the landing's reading shelf (Visual Maturity 2).
 *
 * The band's own card is flat (`ShelfBookCard`), so the feature cannot be a card either: it is a book
 * on a table — one large cover with the title, author and description beside it, asymmetric (five
 * columns of cover, seven of text). A real cover is used at the largest size the page gives a book;
 * without one the generated spine stands in, at the same size, so the composition never collapses.
 */
export function FeaturedBook({ c }: { c: BackendContent }) {
  const media = resolveCover(c);
  const author = c.scholars[0]?.scholar?.name ?? '';
  const subj = c.subjects[0]?.subject;
  return (
    <Link to={`/books/${c.slug}`} className="lift group grid gap-6 sm:gap-8 lg:grid-cols-[0.42fr_1fr] lg:items-center">
      <MediaThumb
        src={media.src}
        kind={media.kind}
        testId="featured-cover"
        className="bg-sand-deep/60 cover-edge mx-auto w-full max-w-[340px] aspect-[3/4] rounded-[14px] lg:max-w-none"
        fallback={<BookSpine c={c} size="large" />}
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {subj && <Tag tone={toneOf(subj.accent)}>{subj.name}</Tag>}
          {c.year && <Tag>{c.year}</Tag>}
        </div>
        <h3 className="font-display text-ink mt-4 text-[1.6rem] leading-[1.08] font-extrabold tracking-[-0.035em] line-clamp-3 sm:text-[2.05rem]">
          {c.title}
        </h3>
        {author && <p className="text-rose mt-3 text-[1rem] font-semibold">{author}</p>}
        {c.description && (
          <p className="text-ink-soft mt-4 max-w-[54ch] text-[0.95rem] leading-relaxed line-clamp-3">{c.description}</p>
        )}
        <div className="text-ink-soft mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.84rem]">
          <span className="text-rose inline-flex items-center gap-2 font-semibold">
            Open book <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
          </span>
          {c.pages && <span className="text-ink-muted">{c.pages} pages</span>}
          {c.language && <span className="text-ink-muted">{c.language}</span>}
        </div>
      </div>
    </Link>
  );
}

/**
 * A scholar tile.
 *
 * The counts are caller-supplied and must come from real data (audit A3/A4): the `/scholars` page
 * counts them over the records it loaded, and a caller that did not measure anything (the landing
 * rail, which must not fire one request per scholar) simply omits them — then the tile shows no
 * number at all instead of an invented one.
 *
 * The footer link goes to **this** scholar's lectures. Before D1 it pointed at the plain `/lectures`
 * list, which silently dropped the scholar (audit A2: "View work" showed someone else's work).
 * Pass `to` to point somewhere else (e.g. the scholar hub once it exists, step D3).
 */
export function ScholarTile({
  s,
  lectureCount,
  bookCount,
  to,
  linkLabel = 'View work',
  variant = 'raised',
}: {
  s: BackendScholar;
  lectureCount?: number;
  bookCount?: number;
  to?: string;
  linkLabel?: string;
  /**
   * `raised` (default) is the tile every existing caller uses. `flat` (Visual Maturity 1) drops the
   * neumorphic shell for a sand plate with a hairline rim and a flat monogram — used on the landing,
   * where the scholars band is the page's *tertiary* surface and should not compete with the two
   * content shelves above it. Same markup, same fields, no shadow.
   */
  variant?: 'raised' | 'flat';
}) {
  const specialtyName = s.specialty?.name ?? '';
  const accent = s.accent ?? 'olive';
  const href = to ?? `/lectures?scholar=${encodeURIComponent(s.slug)}`;
  const hasCounts = typeof lectureCount === 'number' && typeof bookCount === 'number';
  const flat = variant === 'flat';
  return (
    <article
      className={
        flat
          ? 'bg-cream/70 flat-edge lift group flex h-full flex-col rounded-[26px] p-6'
          : 'bg-cream neu-raised lift group flex h-full flex-col rounded-[30px] p-7'
      }
    >
      <div className="flex items-center gap-4">
        <div
          className={`font-display grid h-16 w-16 shrink-0 place-items-center rounded-full text-[1.3rem] font-extrabold ${
            flat ? 'bg-cream ring-line ring-1' : 'neu-inset-sm'
          } ${accent === 'rose' ? 'bg-rose/10 text-rose' : 'bg-sand text-olive-deep'}`}
        >
          {s.initials ?? s.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h3 className="font-display text-ink text-[1.2rem] leading-tight font-extrabold tracking-[-0.02em]">
            {s.name}
          </h3>
          {specialtyName && <Tag tone={accent === 'rose' ? 'rose' : 'olive'}>{specialtyName}</Tag>}
        </div>
      </div>

      <p className="text-ink-soft mt-5 mb-6 text-[0.9rem] leading-relaxed line-clamp-3">{s.bio ?? ''}</p>

      {hasCounts ? (
        <Link to={href} className="border-line/70 text-ink-soft mt-auto flex items-center justify-between border-t pt-4 text-[0.82rem] font-medium transition-colors hover:text-rose">
          <span>{lectureCount} lectures</span>
          <span>{bookCount} books</span>
          <span className="text-rose inline-flex items-center gap-1">
            {linkLabel} <span aria-hidden="true">→</span>
          </span>
        </Link>
      ) : (
        <Link to={href} className="border-line/70 text-ink-soft mt-auto flex items-center justify-between border-t pt-4 text-[0.82rem] font-medium transition-colors hover:text-rose">
          <span className="text-rose inline-flex items-center gap-1">
            {linkLabel} <span aria-hidden="true">→</span>
          </span>
        </Link>
      )}
    </article>
  );
}

/**
 * One subject tile (D3; moved into the shared card module in D4).
 *
 * The tile used to print "N lectures / N books" counted in the browser from a `limit=100` content
 * request — a number that silently stopped at the 100th published record (audit A5). Either a tile
 * needs one counting request per subject, or it shows no number at all; `AGENTS.md` §2 allows exactly
 * these two options ("Public counters come from the API ..., or are not shown at all"), so D3 chose the
 * second and moved the real total to the subject's own page, where it is `pagination.total`.
 *
 * D4 lifted it out of `pages/Subjects.tsx` unchanged, so the subject hub and the search results show the
 * same subject the same way — the search page must not grow a second subject card.
 */
export function SubjectTile({ s }: { s: BackendSubject }) {
  const badge =
    s.accent === 'rose' ? 'bg-rose text-cream' : s.accent === 'olive' ? 'bg-olive text-night' : 'bg-sand text-ink-soft';
  return (
    <article className="bg-cream neu-raised lift group flex h-full flex-col rounded-[30px] p-7">
      <div className="flex items-start justify-between gap-4">
        <div className={`font-display grid h-14 w-14 shrink-0 place-items-center rounded-[18px] text-[1.25rem] font-extrabold neu-raised-sm ${badge}`}>
          {s.name.charAt(0)}
        </div>
        <span className="text-ink-muted text-[0.7rem] font-semibold tracking-[0.16em] uppercase">{s.group}</span>
      </div>

      <h3 className="font-display text-ink mt-5 text-[1.4rem] leading-tight font-extrabold tracking-[-0.03em]">{s.name}</h3>
      <p className="text-ink-soft mt-3 flex-1 text-[0.92rem] leading-relaxed line-clamp-3">{s.description ?? ''}</p>

      <div className="border-line/70 mt-6 flex items-center justify-end border-t pt-5">
        <Link to={`/subjects/${encodeURIComponent(s.slug)}`} className="text-rose inline-flex items-center gap-1.5 text-[0.86rem] font-semibold transition-all group-hover:gap-2.5">
          Explore <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}

/** The scholar fields a rail can rely on: a content *list* carries this reduced join row. */
export type MiniScholar = Pick<BackendScholar, 'id' | 'slug' | 'name' | 'initials' | 'accent'>;

/**
 * A compact scholar card (Discovery step D3).
 *
 * `ScholarTile` needs a bio, and a content list only carries the reduced join row
 * (`id, slug, name, initials, accent` — `server/src/lib/public-payload.ts`). A rail built from such a
 * list would therefore render an empty paragraph. This card shows what really exists and nothing more,
 * and its only destination is the scholar's own page — no invented number, no invented role.
 */
export function ScholarMiniCard({ scholar }: { scholar: MiniScholar }) {
  const accent = scholar.accent ?? 'olive';
  return (
    <Link
      to={`/scholars/${encodeURIComponent(scholar.slug)}`}
      className="bg-cream neu-raised lift group flex h-full items-center gap-4 rounded-[26px] p-5"
    >
      <div
        className={`font-display grid h-12 w-12 shrink-0 place-items-center rounded-full text-[1rem] font-extrabold neu-inset-sm ${
          accent === 'rose' ? 'bg-rose/10 text-rose' : 'bg-sand text-olive-deep'
        }`}
      >
        {scholar.initials ?? scholar.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="font-display text-ink truncate text-[1.02rem] leading-tight font-extrabold tracking-[-0.02em]">{scholar.name}</p>
        <p className="text-rose text-[0.82rem] font-semibold">
          View work <span aria-hidden="true">→</span>
        </p>
      </div>
    </Link>
  );
}

/**
 * The loading placeholder for a card. The two shapes match the two frames the pages use, so a
 * skeleton never has a different size than the card that replaces it (no layout jump).
 */
export function CardSkeleton({ media = 'video' }: { media?: 'video' | 'book' }) {
  // The two variants are written out (rather than composed from a template) so the markup stays
  // character-for-character what the pages shipped before the extraction.
  if (media === 'book') {
    return (
      <article className="bg-cream neu-raised flex flex-col rounded-[30px] p-6 animate-pulse">
        <div className="bg-sand neu-inset aspect-[3/4] rounded-[22px]" />
        <div className="mt-5 space-y-3">
          <div className="bg-sand h-4 w-24 rounded-full" />
          <div className="bg-sand h-6 w-full rounded-full" />
          <div className="bg-sand h-4 w-3/4 rounded-full" />
          <div className="bg-sand h-3 w-full rounded-full" />
        </div>
      </article>
    );
  }
  return (
    <article className="bg-cream neu-raised flex flex-col rounded-[30px] p-6 animate-pulse">
      <div className="bg-sand neu-inset aspect-[16/10] rounded-[22px]" />
      <div className="mt-5 space-y-3">
        <div className="bg-sand h-4 w-24 rounded-full" />
        <div className="bg-sand h-6 w-full rounded-full" />
        <div className="bg-sand h-4 w-3/4 rounded-full" />
        <div className="bg-sand h-3 w-2/3 rounded-full" />
      </div>
    </article>
  );
}

/** The loading placeholder for a scholar/subject tile. */
export function TileSkeleton() {
  return (
    <article className="bg-cream neu-raised flex flex-col rounded-[30px] p-7 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="bg-sand neu-inset-sm h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <div className="bg-sand h-5 w-32 rounded-full" />
          <div className="bg-sand h-4 w-20 rounded-full" />
        </div>
      </div>
      <div className="bg-sand mt-5 h-16 rounded-[16px]" />
      <div className="bg-sand mt-6 h-4 w-full rounded-full" />
    </article>
  );
}
