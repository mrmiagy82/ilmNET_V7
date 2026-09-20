import type { ReactNode } from 'react';
import Aurora from './Aurora';

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
    <section className="relative overflow-hidden px-5 pb-12 pt-32 sm:px-6 sm:pt-40 lg:pb-16 lg:pt-44">
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-[560px] opacity-[0.32]"
        style={{
          maskImage: 'radial-gradient(120% 80% at 50% 18%, #000 12%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(120% 80% at 50% 18%, #000 12%, transparent 70%)',
        }}
      >
        <Aurora colorStops={['#A2AB73', '#CC3A63', '#5227FF']} blend={0.57} amplitude={1.0} speed={1} />
      </div>

      <div className="relative mx-auto max-w-[1180px]">
        <div className="grid gap-10 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div className="animate-rise max-w-[640px]">
            <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.22em] uppercase">{eyebrow}</p>
            <h1 className="text-display-xl text-ink mt-4 text-[clamp(2.4rem,6.6vw,4.4rem)]">{title}</h1>
            <p className="text-ink-soft mt-6 max-w-[52ch] text-[1.06rem] leading-[1.7]">{intro}</p>
          </div>
          {meta && <div className="animate-rise [animation-delay:140ms] lg:pb-2">{meta}</div>}
        </div>
      </div>
    </section>
  );
}
