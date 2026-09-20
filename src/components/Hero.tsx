import { Link } from 'react-router-dom';
import Aurora from './Aurora';

function PlayIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8 5.6c0-.9 1-1.5 1.8-1l8.1 5.1a1.2 1.2 0 0 1 0 2L9.8 17c-.8.5-1.8-.1-1.8-1V5.6Z" />
    </svg>
  );
}

const bars = [14, 26, 38, 22, 44, 30, 52, 36, 24, 42, 18, 32, 46, 26, 16, 34, 22, 40, 28, 18];

function LectureSurface() {
  return (
    <div className="bg-cream neu-float relative rounded-[36px] p-6 sm:p-8">
      <div className="flex items-center gap-4">
        <div className="bg-sand neu-inset-sm grid h-12 w-12 shrink-0 place-items-center rounded-2xl">
          <span className="font-display text-olive-deep text-sm font-extrabold">04</span>
        </div>
        <div className="min-w-0">
          <p className="text-ink-muted text-[0.7rem] font-semibold tracking-[0.18em] uppercase">Now playing</p>
          <p className="font-display text-ink truncate text-[1.05rem] font-bold tracking-tight">
            Uṣūl al-Fiqh · The Sources
          </p>
        </div>
      </div>

      <div className="mt-7 flex h-16 items-end gap-[3px]">
        {bars.map((h, i) => (
          <span
            key={i}
            style={{ height: `${h + 8}px` }}
            className={`flex-1 rounded-full ${i < 9 ? 'bg-rose/75' : 'bg-olive/45'}`}
          />
        ))}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button className="bg-sand neu-raised-sm text-rose grid h-14 w-14 shrink-0 place-items-center rounded-full transition-transform hover:scale-[1.04] active:scale-95">
          <PlayIcon className="h-6 w-6" />
        </button>
        <div className="w-full">
          <div className="bg-sand neu-inset-sm h-2.5 w-full rounded-full">
            <div className="bg-rose h-2.5 w-[42%] rounded-full" />
          </div>
          <div className="text-ink-muted mt-2 flex justify-between text-[0.72rem] font-medium">
            <span>18:24</span>
            <span>43:50</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function BookSurface() {
  return (
    <div className="bg-sand neu-raised w-[190px] rounded-[26px] p-5 sm:w-[215px]">
      <div className="flex gap-1.5">
        <span className="bg-olive h-16 w-4 rounded-[4px]" />
        <span className="bg-rose/80 h-16 w-3 rounded-[4px]" />
        <span className="bg-ink/70 h-16 w-2.5 rounded-[4px]" />
        <span className="bg-olive/50 h-16 w-3.5 rounded-[4px]" />
      </div>
      <p className="font-display text-ink mt-4 text-[0.98rem] leading-tight font-bold tracking-tight">
        The Book of Knowledge
      </p>
      <p className="text-ink-muted mt-1.5 text-[0.78rem]">Chapter 3 · 62 pages left</p>
    </div>
  );
}

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-20 sm:pt-40 lg:pt-44 lg:pb-32">
      {/* Atmospheric aurora */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-[720px] opacity-[0.55]"
        style={{
          maskImage: 'radial-gradient(120% 78% at 50% 22%, #000 18%, transparent 74%)',
          WebkitMaskImage: 'radial-gradient(120% 78% at 50% 22%, #000 18%, transparent 74%)',
        }}
      >
        <Aurora colorStops={['#A2AB73', '#CC3A63', '#5227FF']} blend={0.57} amplitude={1.0} speed={1} />
      </div>
      <div className="from-cream/10 via-cream/55 to-cream pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-gradient-to-b" />

      <div className="relative mx-auto grid max-w-[1180px] grid-cols-1 items-center gap-16 px-5 sm:px-6 lg:grid-cols-[1.04fr_0.96fr] lg:gap-14">
        {/* Copy */}
        <div className="animate-rise max-w-[610px]">
          <span className="bg-cream/80 neu-raised-sm text-ink-soft inline-flex items-center gap-2.5 rounded-full py-2 pr-5 pl-2.5 text-[0.78rem] font-semibold tracking-[0.02em] backdrop-blur">
            <span className="bg-olive h-2 w-2 rounded-full" />
            A curated Islamic knowledge library
          </span>

          <h1 className="text-display-xl text-ink mt-7 text-[clamp(2.85rem,8.4vw,5.1rem)]">
            Sacred knowledge,
            <br />
            <span className="text-rose">quietly</span> within reach.
          </h1>

          <p className="text-ink-soft mt-7 max-w-[430px] text-[1.06rem] leading-[1.65]">
            ilmNet brings lectures, books and scholarship into one calm, carefully organised space —
            arranged by scholar, subject and series, so seeking is never searching.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <Link
              to="/lectures"
              className="bg-rose text-cream inline-flex items-center justify-center rounded-[20px] px-8 py-[1.15rem] text-[1rem] font-semibold shadow-[10px_14px_30px_rgba(204,58,99,0.28)] transition-all hover:-translate-y-0.5 hover:bg-[#b83156]"
            >
              Explore the library
            </Link>
            <a
              href="#how"
              className="bg-sand text-ink neu-raised-sm inline-flex items-center justify-center rounded-[20px] px-8 py-[0.95rem] text-[1rem] font-semibold transition-transform hover:-translate-y-0.5"
            >
              How ilmNet works
            </a>
          </div>

          <dl className="border-line/80 mt-12 flex max-w-[460px] gap-8 border-t pt-7 sm:gap-12">
            {[
              ['1,240+', 'Lectures'],
              ['380', 'Books'],
              ['96', 'Scholars'],
            ].map(([n, l]) => (
              <div key={l}>
                <dt className="font-display text-ink text-[1.5rem] font-extrabold tracking-tight">{n}</dt>
                <dd className="text-ink-muted mt-1 text-[0.82rem] font-medium tracking-[0.08em] uppercase">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Spatial composite */}
        <div className="animate-rise relative mx-auto w-full max-w-[520px] [animation-delay:160ms] lg:max-w-none">
          <div className="bg-sand/70 neu-inset absolute -inset-4 rounded-[52px] sm:-inset-8" />
          <div className="relative px-2 py-6 sm:px-6 sm:py-10">
            <div className="animate-drift">
              <LectureSurface />
            </div>

            <div className="animate-drift absolute -top-1 -right-1 hidden [animation-delay:1.4s] sm:-top-4 sm:-right-6 sm:block">
              <div className="rotate-[6deg]">
                <BookSurface />
              </div>
            </div>

            <div className="bg-cream neu-raised absolute -bottom-2 -left-2 flex items-center gap-3 rounded-[20px] px-4 py-3 sm:-bottom-5 sm:-left-8">
              <span className="bg-olive/20 text-olive-deep grid h-9 w-9 place-items-center rounded-full">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              </span>
              <div>
                <p className="font-display text-ink text-[0.88rem] font-bold">Ḥadīth · Series 2</p>
                <p className="text-ink-muted text-[0.74rem]">Continue where you left off</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
