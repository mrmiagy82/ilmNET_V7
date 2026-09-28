import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPublicSubjects, type BackendSubject } from '../lib/api';

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
  olive: 'bg-olive text-night shadow-[8px_10px_24px_rgba(140,150,100,0.35)]',
  plain: 'bg-cream text-ink neu-raised-sm',
};

/**
 * The subject pills on the landing page.
 *
 * D1 (audit A1): this file used to render a second section, `#scholars` ("Every lesson has a teacher."),
 * from the same ranked **subjects** — a scholar heading over subject data, linking every tile to a
 * subject page. That block is gone; the landing's scholar rail (`components/LandingRails.tsx`) shows
 * real published scholars in its place.
 */
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

  // D3 (audit A5): this block used to rank and label the pills with a count taken from the first 100
  // published contents — a number that silently under-reports and cannot be seen as incomplete. A
  // subject has no cheap real total here, so the pills carry no number at all; alphabetical order is
  // the only ordering that needs no invented data, and it no longer costs a full-library request.
  const ranked = useMemo(() => [...subjects].sort((a, b) => a.name.localeCompare(b.name)), [subjects]);
  const pills = ranked.slice(0, 12);

  return (
      <section
        id="subjects"
        className="bg-sand-deep relative px-5 py-20 sm:px-6 lg:py-28"
      style={{ boxShadow: 'inset 0 22px 44px -28px rgba(150,123,80,0.5), inset 0 -22px 44px -28px rgba(150,123,80,0.5)' }}
    >
      <div className="mx-auto grid max-w-[1180px] gap-14 lg:grid-cols-[0.82fr_1.18fr] lg:items-start lg:gap-20">
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

        <div className="flex min-h-[8rem] flex-wrap content-start gap-3 sm:gap-4">
          {loading && (
            <span className="text-ink-muted text-[0.9rem] font-medium">Loading subjects…</span>
          )}
          {!loading &&
            pills.map((s, i) => {
              const size = i === 0 || i === 1 ? 'lg' : 'md';
              return (
                <Link
                  key={s.id}
                  to={`/subjects/${s.slug}`}
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
  );
}
