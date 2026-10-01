import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPublicSubjects, type BackendSubject } from '../lib/api';

/**
 * The subject band on the landing page (Visual Maturity 2).
 *
 * What it was: a header on the left and a cloud of twelve pills on the right — the same "heading plus
 * one row of small things" shape as every other band, on the page's one deep-warm surface.
 *
 * What it is now: an **atlas**. The same header stays on the left (it already worked: it is the only
 * band where the page explains itself), and the right side becomes a mosaic of eight real subjects —
 * the first one larger, carrying its own description, the rest as compact tiles. Every tile is a link
 * to that subject's page, every word comes from `/api/subjects`, and the sizes are a fixed, honest
 * rule (the first subject is the feature; nothing claims to be more popular than another).
 *
 * The band keeps its existing surface (`band-sand-deep`) and now uses the shared utility instead of an
 * inline style, so the two deep bands of the page cannot drift apart.
 *
 * Honesty rules that stay: no counts on tiles (a subject has no cheap real total here — audit A5),
 * alphabetical order, the loading and empty states unchanged, and everything hidden if the request
 * fails.
 */
const TILES = 8;

export default function Subjects() {
  const [subjects, setSubjects] = useState<BackendSubject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await listPublicSubjects();
        if (!alive) return;
        setSubjects(res.data);
      } catch {
        // Never invent numbers on the landing page: without data we only keep the CTA below.
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // D3 (audit A5): alphabetical order is the only ordering that needs no invented data, and it no
  // longer costs a full-library request.
  const ranked = useMemo(() => [...subjects].sort((a, b) => a.name.localeCompare(b.name)), [subjects]);
  const tiles = ranked.slice(0, TILES);

  return (
    <section id="subjects" className="relative band-sand-deep px-5 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto grid max-w-[1180px] gap-14 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:gap-16">
        <div className="lg:sticky lg:top-32">
          <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.22em] uppercase">Browse by subject</p>
          <h2 className="text-display-xl text-ink mt-5 text-[clamp(2rem,4.8vw,3.2rem)]">
            Start from what you want to understand.
          </h2>
          <p className="text-ink-soft mt-6 max-w-[42ch] text-[1.02rem] leading-[1.7]">
            Subjects are the front door. Choose a discipline and ilmNet gathers every lecture, book and
            series that belongs to it — in a sensible order.
          </p>
          <Link
            to="/subjects"
            className="text-rose mt-8 inline-flex items-center gap-2 text-[0.98rem] font-semibold transition-all hover:gap-3"
          >
            See all subjects
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        {loading ? (
          <div className="grid min-h-[8rem] grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`bg-cream/50 animate-pulse rounded-[22px] ${i === 0 ? 'col-span-2 h-[132px]' : 'h-[104px]'}`} aria-hidden="true" />
            ))}
          </div>
        ) : tiles.length === 0 ? (
          <p className="text-ink-muted text-[0.9rem] font-medium">
            The subject shelves are being filled — check back shortly.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {tiles.map((s, i) => {
              const feature = i === 0;
              const accent =
                s.accent === 'rose'
                  ? 'bg-rose/10 text-rose'
                  : s.accent === 'olive'
                    ? 'bg-olive/20 text-olive-deep'
                    : 'bg-cream/70 text-ink';
              return (
                <Link
                  key={s.id}
                  to={`/subjects/${encodeURIComponent(s.slug)}`}
                  className={`group flex flex-col rounded-[22px] border border-line/70 bg-cream/70 p-5 transition-colors hover:border-rose/40 hover:bg-cream sm:p-6 ${
                    feature ? 'col-span-2' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={`font-display grid h-11 w-11 shrink-0 place-items-center rounded-[14px] text-[1.1rem] font-extrabold ${accent}`}>
                      {s.name.charAt(0)}
                    </span>
                    <span className="text-ink-muted text-[0.66rem] font-semibold tracking-[0.16em] uppercase">{s.group}</span>
                  </div>
                  <h3 className={`font-display text-ink mt-4 leading-tight font-extrabold tracking-[-0.03em] ${feature ? 'text-[1.5rem] sm:text-[1.7rem]' : 'text-[1.15rem]'}`}>
                    {s.name}
                  </h3>
                  {feature && s.description && (
                    <p className="text-ink-soft mt-3 max-w-[52ch] text-[0.92rem] leading-relaxed line-clamp-3">{s.description}</p>
                  )}
                  <span className="text-rose mt-4 inline-flex items-center gap-1.5 text-[0.82rem] font-semibold transition-all group-hover:gap-2.5">
                    Explore <span aria-hidden="true">→</span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
