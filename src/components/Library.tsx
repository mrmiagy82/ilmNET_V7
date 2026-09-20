const shelves = [
  {
    kicker: '01 — Listen',
    title: 'Lectures & lessons',
    body: 'Full courses, single talks and ongoing series — organised into sequences you can actually finish.',
    meta: ['Tafsīr', 'Fiqh', 'Sīrah'],
    accent: 'rose' as const,
  },
  {
    kicker: '02 — Read',
    title: 'Books & treatises',
    body: 'Classical texts and contemporary works, with clean reading, saved progress and chapter navigation.',
    meta: ['Translations', 'Commentary', 'Primers'],
    accent: 'olive' as const,
  },
  {
    kicker: '03 — Follow',
    title: 'Scholars & schools',
    body: 'Every item traced back to its teacher, so you always know who you are learning from.',
    meta: ['Biographies', 'Collections', 'Lineage'],
    accent: 'ink' as const,
  },
];

function Glyph({ accent }: { accent: 'rose' | 'olive' | 'ink' }) {
  const fill = accent === 'rose' ? '#cc3a63' : accent === 'olive' ? '#a2ab73' : '#26241f';
  return (
    <div className="bg-cream neu-raised-sm grid h-14 w-14 place-items-center rounded-[18px]">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke={fill} strokeWidth="1.8" strokeLinecap="round">
        {accent === 'rose' && <path d="M12 3v14m0 0a3 3 0 1 1-3-3m3 3 8-3V3l-8 3" />}
        {accent === 'olive' && <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 0 4 18.5v-13ZM12 3h5.5A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 0-2.5 2.5H12" />}
        {accent === 'ink' && <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8.5C5 16.9 8.1 15 12 15s7 1.9 7 5.5" />}
      </svg>
    </div>
  );
}

export default function Library() {
  return (
    <section id="library" className="relative px-5 py-24 sm:px-6 lg:py-36">
      <div className="mx-auto max-w-[1180px]">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.85fr] lg:items-end">
          <h2 className="text-display-xl text-ink max-w-[16ch] text-[clamp(2.2rem,5.4vw,3.6rem)]">
            One library. Three ways to seek.
          </h2>
          <p className="text-ink-soft max-w-[46ch] text-[1.03rem] leading-[1.7] lg:pb-2">
            Nothing is buried in a feed. Everything on ilmNet lives in a structured shelf — listen, read,
            or follow a scholar from first lesson to last.
          </p>
        </div>

        <div className="bg-sand/80 neu-inset mt-14 rounded-[44px] p-4 sm:p-7 lg:mt-20 lg:p-9">
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
            {shelves.map((s) => (
              <article
                key={s.title}
                className="bg-cream neu-raised group flex flex-col rounded-[30px] p-7 transition-transform duration-500 hover:-translate-y-1.5 sm:p-8"
              >
                <Glyph accent={s.accent} />
                <p className="text-ink-muted mt-7 text-[0.72rem] font-semibold tracking-[0.2em] uppercase">
                  {s.kicker}
                </p>
                <h3 className="font-display text-ink mt-3 text-[1.55rem] leading-tight font-extrabold tracking-[-0.03em]">
                  {s.title}
                </h3>
                <p className="text-ink-soft mt-4 text-[0.97rem] leading-[1.65]">{s.body}</p>
                <div className="mt-8 flex flex-wrap gap-2 pt-1">
                  {s.meta.map((m) => (
                    <span
                      key={m}
                      className="bg-sand neu-inset-sm text-ink-soft rounded-full px-3.5 py-1.5 text-[0.78rem] font-medium"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
