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
import type { BackendContent, BackendScholar } from '@/lib/api';
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
    <Link to={to} className="bg-cream neu-raised group flex flex-col rounded-[30px] p-6 transition-transform duration-500 hover:-translate-y-1.5">
      {children}
    </Link>
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
        <span className="bg-cream/90 text-ink neu-raised-sm absolute right-3 top-3 rounded-full px-3 py-1.5 text-[0.72rem] font-semibold">
          {format}
        </span>
        {c.provider === 'youtube' && <span className="bg-rose/90 text-cream absolute left-3 top-3 rounded-full px-2.5 py-1 text-[0.62rem] font-bold">YouTube</span>}
        {c.provider === 'archive' && <span className="bg-olive/90 text-white absolute left-3 top-3 rounded-full px-2.5 py-1 text-[0.62rem] font-bold">Archive</span>}
      </MediaThumb>

      <div className="flex flex-1 flex-col px-1 pt-5">
        <div className="flex items-center gap-2 flex-wrap">
          {subj && <Tag tone={toneOf(subj.accent)}>{subj.name}</Tag>}
          <Tag tone="plain">{isVideo ? 'Video' : 'Audio'}</Tag>
          {c.language && <span className="bg-sand text-ink-soft rounded-full px-2.5 py-1 text-[0.62rem] font-medium">{c.language}</span>}
        </div>
        <h3 className="font-display text-ink mt-3 text-[1.18rem] leading-snug font-extrabold tracking-[-0.02em] line-clamp-2">
          {c.title}
        </h3>
        <span className="text-rose mt-2 text-[0.9rem] font-semibold line-clamp-1">
          {scholarName}
        </span>
        <p className="text-ink-muted mt-3 text-[0.84rem] line-clamp-2">
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

/** A series / playlist group as shown on the lectures shelf. */
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
        <div className="bg-cream/90 neu-raised-sm absolute left-3 top-3 flex items-center gap-2 rounded-full px-3 py-1.5">
          <span className={`h-2 w-2 rounded-full ${isPlaylist ? 'bg-rose' : 'bg-olive'}`} />
          <span className="text-ink text-[0.68rem] font-bold tracking-[0.08em] uppercase">{isPlaylist ? 'Playlist' : s.type === 'collection' ? 'Collection' : 'Series'} · {s.count}</span>
        </div>
        <span className="bg-cream/90 text-ink neu-raised-sm absolute right-3 top-3 rounded-full px-3 py-1.5 text-[0.68rem] font-semibold">
          {s.provider === 'youtube' ? 'YouTube' : s.provider === 'archive' ? 'Archive' : s.provider}
        </span>
        <div className="bg-cream neu-raised-sm text-ink absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-[14px] px-4 py-3">
          <span className="text-[0.78rem] font-semibold">{s.count} episodes</span>
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
        <p className="text-ink-muted mt-3 text-[0.84rem] line-clamp-2">
          {s.description ?? `${s.count} items — open to see all episodes.`}
        </p>
        <div className="border-line/70 mt-5 flex items-center justify-between border-t pt-4 text-[0.8rem]">
          <span className="text-ink-soft font-medium">{s.scholars.length ? `${s.scholars.length} scholars` : `${s.count} parts`}</span>
          <span className="text-ink-muted">{s.provider === 'youtube' ? 'YouTube' : 'Archive'}</span>
        </div>
      </div>
    </CardShell>
  );
}

/** The generated spine shown when a book has no usable cover (never a fake cover image). */
export function BookCover({ c }: { c: BackendContent }) {
  const media = resolveCover(c);
  const subj = c.subjects[0]?.subject;
  const cover = subj?.accent === 'rose' ? 'from-rose/85 to-rose-deep' : subj?.accent === 'olive' ? 'from-olive to-olive-deep' : 'from-ink/80 to-ink';
  // generated spine, always behind the image so a broken upload still shows something useful
  const spine = (
    <div className="absolute inset-0 grid place-items-center">
      <div className={`relative h-[150px] w-[112px] overflow-hidden rounded-[8px] bg-gradient-to-br ${cover} shadow-[10px_14px_26px_rgba(60,45,30,0.28)]`}>
        <div className="absolute inset-y-0 left-0 w-2.5 bg-black/20" />
        <div className="absolute inset-y-0 left-2.5 w-1 bg-white/25" />
        <div className="flex h-full flex-col justify-between p-3 pl-4">
          <span className="text-cream/80 text-[0.6rem] font-semibold uppercase tracking-[0.14em]">{c.type === 'document' ? 'Document' : 'Book'}</span>
          <div>
            <p className="font-display text-cream text-[0.92rem] leading-tight font-extrabold line-clamp-3">{c.title}</p>
            <p className="text-cream/70 mt-1 text-[0.66rem] line-clamp-1">{c.scholars[0]?.scholar?.name ?? ''}</p>
          </div>
        </div>
      </div>
    </div>
  );
  return (
    <MediaThumb
      src={media.src}
      kind={media.kind}
      testId="book-cover"
      className="bg-sand neu-inset aspect-[3/4] rounded-[22px]"
      fallback={spine}
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
        <div className="bg-cream/90 neu-raised-sm absolute left-3 top-3 flex items-center gap-2 rounded-full px-3 py-1.5">
          <span className="bg-olive h-2 w-2 rounded-full" />
          <span className="text-ink text-[0.68rem] font-bold tracking-[0.08em] uppercase">Collection · {s.count}</span>
        </div>
        <span className="bg-olive/90 text-white absolute right-3 top-3 rounded-full px-2.5 py-1 text-[0.62rem] font-bold">Archive</span>
        <div className="bg-cream neu-raised-sm text-ink absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-[14px] px-4 py-3">
          <span className="text-[0.78rem] font-semibold">{s.count} books</span>
          <span className="text-rose text-[0.78rem] font-bold">Open collection →</span>
        </div>
      </MediaThumb>
      <div className="flex flex-1 flex-col px-1 pt-5">
        {subj && <Tag tone={toneOf(subj.accent)}>{subj.name}</Tag>}
        <h3 className="font-display text-ink mt-3 text-[1.18rem] leading-snug font-extrabold tracking-[-0.02em] line-clamp-2">
          {s.title}
        </h3>
        <p className="text-ink-soft mt-3 text-[0.88rem] line-clamp-3">{s.description ?? `${s.count} books — open to see all.`}</p>
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
    <Link to={`/series/${encodeURIComponent(s.id)}`} className="bg-cream neu-raised group flex flex-col rounded-[30px] p-6 transition-transform hover:-translate-y-1.5">
      <MediaThumb
        src={thumb}
        kind={media.kind}
        testId="subject-series-thumb"
        className="bg-sand neu-inset aspect-[16/10] rounded-[22px]"
        fallback={<div className="absolute inset-0 bg-gradient-to-br from-olive/15 to-rose/15" />}
      >
        <span className="bg-cream/90 text-ink absolute left-3 top-3 rounded-full px-3 py-1.5 text-[0.68rem] font-bold">Series · {s.count}</span>
        <span className="bg-cream neu-raised-sm absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-[12px] px-3 py-2 text-[0.76rem] font-semibold">
          <span>{s.count} parts</span><span className="text-rose">Open →</span>
        </span>
      </MediaThumb>
      <h3 className="font-display text-ink mt-4 line-clamp-2 text-[1.1rem] font-extrabold">{s.title}</h3>
      <p className="text-ink-muted mt-2 line-clamp-2 text-[0.82rem]">{s.description ?? `${s.count} items`}</p>
    </Link>
  );
}

/** The tighter content card used inside a subject page. */
export function CompactContentCard({ c }: { c: BackendContent }) {
  const isBook = c.type === 'book' || c.type === 'document';
  const media = resolveCardMedia(c);
  const thumb = media.src;
  return (
    <Link to={`/${isBook ? 'books' : 'lectures'}/${c.slug}`} className="bg-cream neu-raised group flex flex-col rounded-[30px] p-6 hover:-translate-y-1.5 transition-transform">
      <MediaThumb
        src={thumb}
        kind={media.kind}
        testId="subject-content-thumb"
        className={`bg-sand neu-inset rounded-[22px] ${isBook ? 'aspect-[3/4]' : 'aspect-[16/10]'}`}
        fallback={<div className="absolute inset-0 bg-gradient-to-br from-sand to-cream" />}
      >
        <span className="bg-cream/90 absolute right-3 top-3 rounded-full px-2.5 py-1 text-[0.62rem] font-semibold">{isBook ? 'Book' : c.type === 'audio' ? 'Audio' : 'Video'}</span>
      </MediaThumb>
      <h3 className="font-display text-ink mt-4 line-clamp-2 text-[1.05rem] font-bold">{c.title}</h3>
      <p className="text-ink-muted mt-2 line-clamp-2 text-[0.82rem]">{c.description?.slice(0, 80) ?? ''}</p>
    </Link>
  );
}

/** A scholar tile. Counts are caller-supplied and must come from real data (audit A3/A4). */
export function ScholarTile({ s, lectureCount, bookCount }: { s: BackendScholar; lectureCount: number; bookCount: number }) {
  const specialtyName = (s as any).specialty?.name ?? '';
  const accent = (s as any).accent ?? s.accent ?? 'olive';
  return (
    <article className="bg-cream neu-raised group flex flex-col rounded-[30px] p-7 transition-transform duration-500 hover:-translate-y-1.5">
      <div className="flex items-center gap-4">
        <div className={`font-display grid h-16 w-16 shrink-0 place-items-center rounded-full text-[1.3rem] font-extrabold neu-inset-sm ${accent === 'rose' ? 'bg-rose/10 text-rose' : 'bg-sand text-olive-deep'}`}>
          {s.initials ?? s.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h3 className="font-display text-ink text-[1.2rem] leading-tight font-extrabold tracking-[-0.02em]">
            {s.name}
          </h3>
          {specialtyName && <Tag tone={accent === 'rose' ? 'rose' : 'olive'}>{specialtyName}</Tag>}
        </div>
      </div>

      <p className="text-ink-soft mt-5 text-[0.9rem] leading-relaxed line-clamp-3">{s.bio ?? ''}</p>

      <Link to="/lectures" className="border-line/70 text-ink-soft mt-6 flex items-center justify-between border-t pt-4 text-[0.82rem] font-medium transition-colors hover:text-rose">
        <span>{lectureCount} lectures</span>
        <span>{bookCount} books</span>
        <span className="text-rose inline-flex items-center gap-1">
          View work <span aria-hidden="true">→</span>
        </span>
      </Link>
    </article>
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
