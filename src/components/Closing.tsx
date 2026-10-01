import { Link } from 'react-router-dom';
import Aurora from './Aurora';

const steps = [
  {
    n: '01',
    accent: 'text-olive-deep',
    title: 'Choose a subject',
    body: 'Pick a discipline or a scholar. ilmNet shows you where a beginner should start.',
  },
  {
    n: '02',
    accent: 'text-rose',
    title: 'Follow the sequence',
    body: 'Lectures and readings are ordered into series, so each lesson builds on the last.',
  },
  {
    n: '03',
    accent: 'text-ink',
    title: 'Pick up any thread',
    body: 'Every lecture, book and series has its own stable link, so you can return straight to the item you were on.',
  },
];

/**
 * "The path" — Visual Maturity 2 turned the explainer into the page's one loud moment.
 *
 * It used to be a raised sand panel with three inset numbered discs: the same cream-on-cream, the same
 * shadow language as the twelve cards above it, and the fourth surface in a row that changed nothing.
 * It is now a **full-bleed olive band** — the first real olive surface in the product — carrying ink
 * text (measured contrast 6.45:1), hairline-separated editorial columns and large display numerals.
 *
 * Why this is allowed to be loud: it is the only band on the page that is about the library rather than
 * part of it, so it can be the one place where the brand colour takes the whole surface. No shadow is
 * used anywhere in it: on a saturated ground the numbers do not need depth to be readable.
 */
export function HowItWorks() {
  return (
    <section id="how" className="band-olive relative px-5 py-16 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-[1180px]">
        <p className="text-ink/80 text-[0.72rem] font-semibold tracking-[0.22em] uppercase">The path</p>
        <h2 className="text-display-xl text-ink mt-5 max-w-[18ch] text-[clamp(1.95rem,4.4vw,3.1rem)]">
          Designed for steady learning, not endless scrolling.
        </h2>

        <div className="border-ink/25 mt-14 grid gap-10 border-t pt-10 sm:gap-0 md:grid-cols-3">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className={`md:px-10 ${i === 0 ? 'md:pl-0' : ''} ${i === 2 ? 'md:pr-0' : ''} ${
                i > 0 ? 'md:border-ink/25 md:border-l' : ''
              }`}
            >
              <span className="font-display text-night block text-[2.4rem] leading-none font-extrabold tracking-[-0.05em]">
                {s.n}
              </span>
              <h3 className="font-display text-ink mt-6 text-[1.35rem] font-extrabold tracking-[-0.03em]">
                {s.title}
              </h3>
              <p className="text-ink mt-3 max-w-[34ch] text-[0.97rem] leading-[1.68]">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCTA() {
  return (
    // Visual Maturity 2: the closing panel is now a full-bleed night band instead of a rounded card
    // floating on cream. The page therefore ends on the darkest surface after the loudest one, and the
    // two stop competing with the cream middle. Inside, only the type grew.
    <section className="bg-night relative overflow-hidden px-5 py-20 text-center sm:px-6 lg:py-28">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[420px] opacity-70"
          style={{
            maskImage: 'linear-gradient(to top, #000 4%, transparent 88%)',
            WebkitMaskImage: 'linear-gradient(to top, #000 4%, transparent 88%)',
            transform: 'rotate(180deg)',
          }}
        >
          <Aurora colorStops={['#A2AB73', '#CC3A63', '#F2E7D3']} blend={0.57} amplitude={1.0} speed={1} />
        </div>

        <div className="relative mx-auto max-w-[760px]">
          <span className="text-cream/70 inline-flex items-center gap-2.5 rounded-full border border-white/15 px-5 py-2 text-[0.78rem] font-semibold backdrop-blur">
            <span className="bg-olive h-2 w-2 rounded-full" />
            Free for everyone
          </span>
          <h2 className="text-display-xl text-cream mt-8 text-[clamp(2.5rem,7.2vw,5rem)]">
            Begin with a single lesson.
          </h2>
          <p className="text-cream/70 mx-auto mt-6 max-w-[48ch] text-[1.05rem] leading-[1.7]">
            ilmNet is free and open — no account, no paywall. Explore the library whenever you are ready.
          </p>

          <div className="mx-auto mt-10 flex w-full max-w-[520px] flex-col gap-3 sm:flex-row">
            <Link
              to="/lectures"
              className="bg-rose text-cream lift-sm inline-flex flex-1 items-center justify-center rounded-[20px] px-8 py-[1.05rem] text-[0.98rem] font-semibold hover:bg-rose-deep"
            >
              Start exploring
            </Link>
            <Link
              to="/subjects"
              className="bg-cream text-ink lift-sm inline-flex flex-1 items-center justify-center rounded-[20px] px-8 py-[1.05rem] text-[0.98rem] font-semibold"
            >
              Browse subjects
            </Link>
          </div>
          <p className="text-cream/40 mt-5 text-[0.8rem]">No sign-in. No noise. Just knowledge.</p>
        </div>
    </section>
  );
}
