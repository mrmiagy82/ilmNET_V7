/**
 * The states every library list shares (Discovery step D2).
 *
 * `/lectures` and `/books` each carried their own copy of the skeleton grid, the error card and the
 * retry button, and the copies had drifted (audit B4/B5/D6/D11): one page reloaded the whole browser
 * window to retry, the other refetched; one printed the raw client message to the visitor, the other a
 * slightly different sentence; the skeletons used different card shapes for no reason.
 *
 * These components are the single version of those three states, so "consistent loading/error/empty"
 * is a property of the code and not something to remember per page.
 */
import { CardSkeleton } from '@/components/cards';

/** The card grid while the first page is on its way. Same count and shape on both shelves. */
export function CardGridSkeleton({ count = 6, media = 'video' }: { count?: number; media?: 'video' | 'book' }) {
  return (
    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} media={media} />
      ))}
    </div>
  );
}

/**
 * The error state of a list.
 *
 * The body is written for a visitor: it says what happened and what they can do, and never prints the
 * client's or the API's raw message (audit B5 \u2014 "Failed to load lectures" and provider errors are
 * developer copy). The retry action is the caller's refetch, not a page reload (audit B4).
 */
export function ListErrorCard({
  title,
  body = 'The library could not be reached just now. This is usually temporary \u2014 try again, or come back in a moment.',
  onRetry,
  retrying = false,
}: {
  title: string;
  body?: string;
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <div className="mt-10 bg-cream neu-raised rounded-[24px] p-8 text-center">
      <p className="font-display text-ink text-[1.1rem] font-bold">{title}</p>
      <p className="text-ink-soft mx-auto mt-2 max-w-[46ch] text-[0.9rem] leading-relaxed">{body}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="bg-rose text-cream mt-6 rounded-full px-6 py-3 text-[0.9rem] font-semibold disabled:opacity-60"
      >
        {retrying ? 'Trying again\u2026' : 'Try again'}
      </button>
    </div>
  );
}

/**
 * "Load more" for a real list (audit A5).
 *
 * It states the honest arithmetic \u2014 how many are shown and how many exist \u2014 so the visitor always
 * knows whether the list they are looking at is the whole library or part of it. The button is the
 * accessible control (a real `<button>`, not a link that pretends to be an action).
 */
export function LoadMore({
  shown,
  total,
  noun,
  loading = false,
  onClick,
}: {
  shown: number;
  total: number;
  /** singular noun of the shelf: "lecture" | "book" */
  noun: string;
  loading?: boolean;
  onClick: () => void;
}) {
  const remaining = Math.max(total - shown, 0);
  const plural = remaining === 1 ? noun : `${noun}s`;
  return (
    <div className="mt-10 flex flex-col items-center gap-3">
      <p className="text-ink-muted text-[0.84rem] font-medium">
        Showing {shown} of {total}
      </p>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        aria-label={`Load more ${plural}`}
        className="bg-cream text-ink neu-raised-sm hover:-translate-y-0.5 rounded-full px-7 py-3.5 text-[0.92rem] font-semibold transition-transform disabled:opacity-60"
      >
        {loading ? 'Loading\u2026' : `Load ${Math.min(remaining, 24)} more`}
      </button>
    </div>
  );
}
