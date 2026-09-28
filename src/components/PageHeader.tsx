import type { ReactNode } from 'react';
import Aurora from './Aurora';

/**
 * The header every subpage shares: eyebrow, title, intro and an optional meta slot.
 *
 * Visual UI Polish (28 September 2026): this is the one place where a whole class of pages is made
 * consistent at once — `/lectures`, `/books`, `/scholars`, `/subjects`, `/search`, the three detail
 * pages, the series page, the 404 and the admin's public-facing states all render through here. Before
 * the polish every page agreed on the elements but not on the *rhythm*: the header ran 128–176 px deep
 * before its first line, the intro sat at a different width than the meta next to it, and there was no
 * line at the bottom, so the header and the page content melted into one long field.
 *
 * What is now fixed by construction:
 *   - one vertical rhythm (`pt-28 sm:pt-32 lg:pt-36`, `pb-10 lg:pb-14`) — the header ends where the
 *     content section begins, on every page;
 *   - one type ladder: a small uppercase eyebrow with a brand dot, the display title, then the intro
 *     capped at a readable measure;
 *   - the meta slot sits in its own column on large screens, separated by a hairline instead of
 *     floating in space; on a phone it simply follows the intro;
 *   - a soft gradient rule closes the header, so the page below starts visibly "after" it.
 *
 * Nothing else changed: the aurora is the same decoration (now with the brand's own third colour
 * instead of the template violet — audit D1) and `meta` is still the caller's own markup.
 */
export default function PageHeader({
  eyebrow,
  title,
  intro,
  meta,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  meta?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden px-5 pt-28 pb-10 sm:px-6 sm:pt-32 lg:pt-36 lg:pb-14">
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-[520px] opacity-[0.4]"
        style={{
          maskImage: 'radial-gradient(120% 80% at 50% 18%, #000 12%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(120% 80% at 50% 18%, #000 12%, transparent 70%)',
        }}
      >
        <Aurora colorStops={['#A2AB73', '#CC3A63', '#F2E7D3']} blend={0.57} amplitude={1.0} speed={1} />
      </div>

      <div className="relative mx-auto max-w-[1180px]">
        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:items-end lg:gap-12">
          <div className="animate-rise max-w-[660px]">
            <p className="text-ink-muted inline-flex items-center gap-2.5 text-[0.72rem] font-semibold tracking-[0.22em] uppercase">
              <span className="bg-rose h-1.5 w-1.5 shrink-0 rounded-full" aria-hidden="true" />
              {eyebrow}
            </p>
            <h1 className="text-display-xl text-ink mt-5 text-[clamp(2.3rem,6.2vw,4.1rem)]">{title}</h1>
            <p className="text-ink-soft mt-6 max-w-[56ch] text-[1.05rem] leading-[1.7]">{intro}</p>
          </div>
          {meta && (
            <div className="animate-rise lg:pb-2 [animation-delay:140ms] lg:border-l lg:border-line/70 lg:pl-8">{meta}</div>
          )}
        </div>

        {/* The header's base line: a hairline that fades out, so the content below reads as a new band
            instead of a continuation of the title block. */}
        <div
          className="from-line mt-10 h-px bg-gradient-to-r to-transparent lg:mt-14"
          aria-hidden="true"
        />
      </div>
    </section>
  );
}
