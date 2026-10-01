import { Link } from 'react-router-dom';

/**
 * "One library. Three ways to seek." — Visual Maturity 2 turned this band into the page's index.
 *
 * Until this phase the three ways were three identical raised cards inside one large inset panel: the
 * same cream-on-cream composition as every shelf above it, and the biggest neumorphic surface on the
 * page carried the *least* content. It is now an **editorial index**: a sand band (the page had cream
 * everywhere) with three numbered rows in the same ladder as a table of contents — a large accent
 * numeral, the shelf's name and explanation, its real subjects as chips, and one link to the shelf
 * that actually exists. Nothing here is invented: the numbers are the three real shelves, the chips are
 * the same static subject words the card already carried as illustration, and every row links to the
 * page it describes (a row that promised a view that does not exist would break the site's own rule).
 *
 * Flat by construction: no shadow, no panel, no card. The band is separated from its neighbours by its
 * surface and by hairlines between the rows.
 */
const shelves = [
  {
    n: '01',
    to: '/lectures',
    action: 'Browse lectures',
    kicker: 'Listen',
    title: 'Lectures & lessons',
    body: 'Full courses, single talks and ongoing series — organised into sequences you can actually finish.',
    meta: ['Tafsīr', 'Fiqh', 'Sīrah'],
    numeral: 'text-rose',
    rule: 'bg-rose/60',
  },
  {
    n: '02',
    to: '/books',
    action: 'Browse books',
    kicker: 'Read',
    title: 'Books & treatises',
    body: 'Classical texts and contemporary works, embedded from Archive.org or Google Books with a direct link to the source.',
    meta: ['Translations', 'Commentary', 'Primers'],
    numeral: 'text-olive-deep',
    rule: 'bg-olive/70',
  },
  {
    n: '03',
    to: '/scholars',
    action: 'Browse scholars',
    kicker: 'Follow',
    title: 'Scholars & schools',
    body: 'Every item traced back to its teacher, so you always know who you are learning from.',
    meta: ['Biographies', 'Collections', 'Lineage'],
    numeral: 'text-ink',
    rule: 'bg-ink/40',
  },
];

export default function Library() {
  return (
    <section id="library" className="relative band-sand px-5 py-16 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-[1180px]">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.85fr] lg:items-end">
          <h2 className="text-display-xl text-ink max-w-[16ch] text-[clamp(2.1rem,5vw,3.3rem)]">
            One library. Three ways to seek.
          </h2>
          <p className="text-ink-soft max-w-[46ch] text-[1.03rem] leading-[1.7] lg:pb-2">
            Nothing is buried in a feed. Everything on ilmNet lives in a structured shelf — listen, read,
            or follow a scholar from first lesson to last.
          </p>
        </div>

        {/* The index itself: one row per shelf, separated by hairlines, each with its own accent. */}
        <div className="mt-12 lg:mt-16">
          {shelves.map((s) => (
            <article
              key={s.n}
              className="border-line/80 group grid grid-cols-[auto_1fr] items-start gap-x-6 gap-y-4 border-t py-8 last:border-b sm:gap-x-10 lg:grid-cols-[7rem_1.25fr_1fr_auto] lg:items-center lg:py-10"
            >
              <p className={`font-display ${s.numeral} col-start-1 row-start-1 text-[2.1rem] leading-none font-extrabold tracking-[-0.05em] sm:text-[2.6rem]`}>
                {s.n}
              </p>
              <div className="col-start-2 row-start-1 min-w-0 lg:col-start-2">
                <p className="text-ink-muted text-[0.7rem] font-semibold tracking-[0.22em] uppercase">{s.kicker}</p>
                <h3 className="font-display text-ink mt-2 text-[1.5rem] leading-tight font-extrabold tracking-[-0.035em] sm:text-[1.75rem]">
                  {s.title}
                </h3>
              </div>
              <p className="text-ink-soft col-span-2 max-w-[52ch] text-[0.97rem] leading-[1.7] lg:col-span-1 lg:col-start-3">
                {s.body}
              </p>
              <div className="col-span-2 flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-1 lg:col-start-4 lg:justify-end">
                {s.meta.map((m) => (
                  <span key={m} className="bg-cream/80 ring-line/80 text-ink-soft rounded-full px-3.5 py-1.5 text-[0.78rem] font-medium ring-1">
                    {m}
                  </span>
                ))}
                <Link
                  to={s.to}
                  className="text-rose focus-visible:outline-none inline-flex shrink-0 items-center gap-2 text-[0.88rem] font-semibold transition-all hover:gap-2.5"
                >
                  {s.action} <span aria-hidden="true">→</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
