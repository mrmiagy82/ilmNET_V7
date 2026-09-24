import { Link } from 'react-router-dom';
import Aurora from './Aurora';

const steps = [
  {
    n: '01',
    title: 'Choose a subject',
    body: 'Pick a discipline or a scholar. ilmNet shows you where a beginner should start.',
  },
  {
    n: '02',
    title: 'Follow the sequence',
    body: 'Lectures and readings are ordered into series, so each lesson builds on the last.',
  },
  {
    n: '03',
    title: 'Pick up any thread',
    body: 'Every lecture, book and series has its own stable link, so you can return straight to the item you were on.',
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="px-5 pb-24 sm:px-6 lg:pb-36">
      <div className="mx-auto max-w-[1180px]">
        <div className="bg-sand neu-raised overflow-hidden rounded-[44px] px-6 py-12 sm:px-12 sm:py-16 lg:px-16 lg:py-20">
          <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.22em] uppercase">The path</p>
          <h2 className="text-display-xl text-ink mt-5 max-w-[18ch] text-[clamp(2rem,4.6vw,3.1rem)]">
            Designed for steady learning, not endless scrolling.
          </h2>

          <div className="border-line mt-14 grid gap-10 border-t pt-4 sm:gap-0 md:grid-cols-3">
            {steps.map((s, i) => (
              <div
                key={s.n}
                className={`pt-10 md:px-10 ${i === 0 ? 'md:pl-0' : ''} ${i === 2 ? 'md:pr-0' : ''} ${
                  i > 0 ? 'md:border-line md:border-l' : ''
                }`}
              >
                <span className="bg-cream neu-inset-sm text-olive-deep font-display inline-grid h-11 w-11 place-items-center rounded-full text-[0.85rem] font-extrabold">
                  {s.n}
                </span>
                <h3 className="font-display text-ink mt-6 text-[1.32rem] font-extrabold tracking-[-0.03em]">
                  {s.title}
                </h3>
                <p className="text-ink-soft mt-3 max-w-[34ch] text-[0.97rem] leading-[1.68]">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function FinalCTA() {
  return (
    <section className="px-5 pb-24 sm:px-6 lg:pb-32">
      <div className="bg-night relative mx-auto max-w-[1180px] overflow-hidden rounded-[48px] px-6 py-20 text-center sm:px-12 lg:py-28">
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[420px] opacity-70"
          style={{
            maskImage: 'linear-gradient(to top, #000 4%, transparent 88%)',
            WebkitMaskImage: 'linear-gradient(to top, #000 4%, transparent 88%)',
            transform: 'rotate(180deg)',
          }}
        >
          <Aurora colorStops={['#A2AB73', '#CC3A63', '#5227FF']} blend={0.57} amplitude={1.0} speed={1} />
        </div>

        <div className="relative mx-auto max-w-[760px]">
          <span className="text-cream/70 inline-flex items-center gap-2.5 rounded-full border border-white/15 px-5 py-2 text-[0.78rem] font-semibold backdrop-blur">
            <span className="bg-olive h-2 w-2 rounded-full" />
            Free for everyone
          </span>
          <h2 className="text-display-xl text-cream mt-8 text-[clamp(2.3rem,6.4vw,4.2rem)]">
            Begin with a single lesson.
          </h2>
          <p className="text-cream/70 mx-auto mt-6 max-w-[48ch] text-[1.05rem] leading-[1.7]">
            ilmNet is free and open — no account, no paywall. Explore the library whenever you are ready.
          </p>

          <div className="mx-auto mt-10 flex w-full max-w-[520px] flex-col gap-3 sm:flex-row">
            <Link
              to="/lectures"
              className="bg-rose text-cream inline-flex flex-1 items-center justify-center rounded-[20px] px-8 py-[1.05rem] text-[0.98rem] font-semibold transition-colors hover:bg-[#b83156]"
            >
              Start exploring
            </Link>
            <Link
              to="/subjects"
              className="bg-cream text-ink inline-flex flex-1 items-center justify-center rounded-[20px] px-8 py-[1.05rem] text-[0.98rem] font-semibold transition-transform hover:-translate-y-0.5"
            >
              Browse subjects
            </Link>
          </div>
          <p className="text-cream/40 mt-5 text-[0.8rem]">No sign-in. No noise. Just knowledge.</p>
        </div>
      </div>
    </section>
  );
}
