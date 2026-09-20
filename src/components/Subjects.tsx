const subjects = [
  { label: "Qur'ān & Tafsīr", size: 'lg', tone: 'rose' },
  { label: 'Ḥadīth', size: 'md', tone: 'plain' },
  { label: 'ʿAqīdah', size: 'md', tone: 'plain' },
  { label: 'Fiqh', size: 'lg', tone: 'olive' },
  { label: 'Sīrah', size: 'md', tone: 'plain' },
  { label: 'Arabic language', size: 'md', tone: 'plain' },
  { label: 'Uṣūl al-Fiqh', size: 'sm', tone: 'plain' },
  { label: 'Tazkiyah', size: 'md', tone: 'olive' },
  { label: 'Islamic history', size: 'sm', tone: 'plain' },
  { label: 'Ethics & adab', size: 'md', tone: 'plain' },
  { label: 'Family & society', size: 'sm', tone: 'plain' },
  { label: 'Comparative thought', size: 'sm', tone: 'plain' },
];

const sizeMap: Record<string, string> = {
  lg: 'text-[1.12rem] px-7 py-4',
  md: 'text-[0.98rem] px-6 py-3.5',
  sm: 'text-[0.88rem] px-5 py-3',
};

const disciplines = [
  { mono: 'T', name: 'Tafsīr', meta: '18 series · 122 hrs' },
  { mono: 'Ḥ', name: 'Ḥadīth', meta: '24 series · 160 hrs' },
  { mono: 'F', name: 'Fiqh', meta: '31 series · 214 hrs' },
  { mono: 'ʿA', name: 'ʿAqīdah', meta: '12 series · 78 hrs' },
  { mono: 'S', name: 'Sīrah', meta: '9 series · 54 hrs' },
];

export default function Subjects() {
  return (
    <>
      <section
        id="subjects"
        className="bg-sand-deep relative px-5 py-24 sm:px-6 lg:py-36"
        style={{ boxShadow: 'inset 0 22px 44px -28px rgba(150,123,80,0.5), inset 0 -22px 44px -28px rgba(150,123,80,0.5)' }}
      >
        <div className="mx-auto grid max-w-[1180px] gap-14 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:gap-20">
          <div className="lg:sticky lg:top-32">
            <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.22em] uppercase">Browse by subject</p>
            <h2 className="text-display-xl text-ink mt-5 text-[clamp(2.1rem,5vw,3.4rem)]">
              Start from what you want to understand.
            </h2>
            <p className="text-ink-soft mt-6 max-w-[42ch] text-[1.02rem] leading-[1.7]">
              Subjects are the front door. Choose a discipline and ilmNet gathers every lecture, book and
              series that belongs to it — in a sensible order.
            </p>
            <a
              href="#/subjects"
              className="text-rose mt-8 inline-flex items-center gap-2 text-[0.98rem] font-semibold transition-all hover:gap-3"
            >
              See all subjects
              <span aria-hidden="true">→</span>
            </a>
          </div>

          <div className="flex flex-wrap gap-3 sm:gap-4">
            {subjects.map((s) => (
              <span
                key={s.label}
                className={`font-display cursor-default rounded-full font-semibold tracking-[-0.015em] transition-transform duration-300 hover:-translate-y-1 ${sizeMap[s.size]} ${
                  s.tone === 'rose'
                    ? 'bg-rose text-cream shadow-[8px_10px_24px_rgba(204,58,99,0.3)]'
                    : s.tone === 'olive'
                      ? 'bg-olive text-[#22251a] shadow-[8px_10px_24px_rgba(140,150,100,0.35)]'
                      : 'bg-cream text-ink neu-raised-sm'
                }`}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="scholars" className="px-5 py-24 sm:px-6 lg:py-36">
        <div className="mx-auto max-w-[1180px]">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <h2 className="text-display-xl text-ink max-w-[14ch] text-[clamp(2.1rem,5vw,3.4rem)]">
              Every lesson has a teacher.
            </h2>
            <p className="text-ink-soft max-w-[40ch] text-[1.02rem] leading-[1.7]">
              Content is attributed, grouped and traceable. Follow a scholar's full body of work rather than
              scattered clips.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:mt-20 lg:grid-cols-5">
            {disciplines.map((d, i) => (
              <div
                key={d.name}
                className="bg-cream neu-raised flex flex-col items-center rounded-[28px] px-4 py-9 text-center transition-transform duration-500 hover:-translate-y-1.5"
              >
                <div
                  className={`grid h-16 w-16 place-items-center rounded-full ${
                    i % 2 === 0 ? 'bg-sand text-olive-deep' : 'bg-rose/10 text-rose'
                  } neu-inset-sm font-display text-[1.25rem] font-extrabold`}
                >
                  {d.mono}
                </div>
                <p className="font-display text-ink mt-5 text-[1.08rem] font-bold tracking-tight">{d.name}</p>
                <p className="text-ink-muted mt-1.5 text-[0.78rem]">{d.meta}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
