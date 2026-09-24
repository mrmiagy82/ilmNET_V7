import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPublicSubjects, listPublishedContents, type BackendContent, type BackendSubject } from '../lib/api';

const sizeMap: Record<string, string> = {
  lg: 'text-[1.12rem] px-7 py-4',
  md: 'text-[0.98rem] px-6 py-3.5',
  sm: 'text-[0.88rem] px-5 py-3',
};

/** First pill rose, second olive, the rest plain — same palette as before, now driven by real data. */
function pillTone(index: number): 'rose' | 'olive' | 'plain' {
  if (index === 0) return 'rose';
  if (index === 1) return 'olive';
  return 'plain';
}

const toneClass: Record<'rose' | 'olive' | 'plain', string> = {
  rose: 'bg-rose text-cream shadow-[8px_10px_24px_rgba(204,58,99,0.3)]',
  olive: 'bg-olive text-[#22251a] shadow-[8px_10px_24px_rgba(140,150,100,0.35)]',
  plain: 'bg-cream text-ink neu-raised-sm',
};

export default function Subjects() {
  const [subjects, setSubjects] = useState<BackendSubject[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [subjRes, contRes] = await Promise.all([
          listPublicSubjects(),
          listPublishedContents({ limit: 100 }).catch(
            () => ({ data: [] as BackendContent[] }) as any,
          ),
        ]);
        if (!alive) return;
        const contents: BackendContent[] = (contRes as any).data ?? [];
        const map = new Map<string, number>();
        for (const s of subjRes.data) map.set(s.id, 0);
        for (const c of contents) {
          for (const cs of c.subjects ?? []) {
            const current = map.get(cs.subjectId);
            if (current !== undefined) map.set(cs.subjectId, current + 1);
          }
        }
        setSubjects(subjRes.data);
        setCounts(map);
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

  const ranked = useMemo(
    () =>
      [...subjects].sort(
        (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.name.localeCompare(b.name),
      ),
    [subjects, counts],
  );
  const pills = ranked.slice(0, 12);
  const top = ranked.slice(0, 5);

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
            <Link
              to="/subjects"
              className="text-rose mt-8 inline-flex items-center gap-2 text-[0.98rem] font-semibold transition-all hover:gap-3"
            >
              See all subjects
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="flex min-h-[8rem] flex-wrap content-start gap-3 sm:gap-4">
            {loading && (
              <span className="text-ink-muted text-[0.9rem] font-medium">Loading subjects…</span>
            )}
            {!loading &&
              pills.map((s, i) => {
                const n = counts.get(s.id) ?? 0;
                const size = i === 0 || i === 1 ? 'lg' : n > 0 ? 'md' : 'sm';
                return (
                  <Link
                    key={s.id}
                    to={`/subjects/${s.slug}`}
                    title={n === 1 ? '1 item' : `${n} items`}
                    className={`font-display inline-flex items-center gap-2 rounded-full font-semibold tracking-[-0.015em] transition-transform duration-300 hover:-translate-y-1 ${sizeMap[size]} ${toneClass[pillTone(i)]}`}
                  >
                    {s.name}
                  </Link>
                );
              })}
            {!loading && pills.length === 0 && (
              <span className="text-ink-muted text-[0.9rem] font-medium">
                The subject shelves are being filled — check back shortly.
              </span>
            )}
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
            {top.map((s, i) => {
              const n = counts.get(s.id) ?? 0;
              return (
                <Link
                  key={s.id}
                  to={`/subjects/${s.slug}`}
                  className="bg-cream neu-raised flex flex-col items-center rounded-[28px] px-4 py-9 text-center transition-transform duration-500 hover:-translate-y-1.5"
                >
                  <div
                    className={`grid h-16 w-16 place-items-center rounded-full ${
                      i % 2 === 0 ? 'bg-sand text-olive-deep' : 'bg-rose/10 text-rose'
                    } neu-inset-sm font-display text-[1.25rem] font-extrabold`}
                  >
                    {s.name.trim().charAt(0)}
                  </div>
                  <p className="font-display text-ink mt-5 text-[1.08rem] font-bold tracking-tight">{s.name}</p>
                  <p className="text-ink-muted mt-1.5 text-[0.78rem]">
                    {n === 0 ? 'No items yet' : n === 1 ? '1 item' : `${n} items`}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
