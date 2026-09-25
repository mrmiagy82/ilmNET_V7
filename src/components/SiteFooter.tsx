import { Link } from 'react-router-dom';
import { BrandLogo } from './Brand';

/**
 * Footer navigation — Fase 5.1.
 *
 * Only destinations that really exist are linked here. Every entry below resolves to a route in
 * `src/App.tsx` and renders that page; `/lectures?type=audio|video` is the filter the Lectures page
 * itself writes to the URL (its "share this URL" contract). `tests/e2e/production.spec.mjs`
 * asserts both properties, so a link to a page that does not exist fails the suite instead of
 * quietly landing on the catch-all route.
 */
const footerCols = [
  {
    head: 'Library',
    links: [
      { label: 'Lectures', to: '/lectures' },
      { label: 'Audio', to: '/lectures?type=audio' },
      { label: 'Video', to: '/lectures?type=video' },
      { label: 'Books', to: '/books' },
    ],
  },
  {
    head: 'Browse',
    links: [
      { label: 'Subjects', to: '/subjects' },
      { label: 'Scholars', to: '/scholars' },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-line/80 border-t px-5 pt-16 pb-12 sm:px-6">
      <div className="mx-auto grid max-w-[1180px] gap-12 md:grid-cols-[1.2fr_repeat(3,0.8fr)]">
        <div>
          {/* The footer link has no aria-label, so the logo carries the name itself (alt="IlmNet").
              32 px tall = 96 px wide, above the package's 80 px minimum for small placements. */}
          <Link to="/" className="flex items-center">
            <BrandLogo variant="primary" className="h-8" />
          </Link>
          <p className="text-ink-muted mt-5 max-w-[30ch] text-[0.92rem] leading-[1.65]">
            A curated library for Islamic knowledge — quiet, structured and built to last.
          </p>
        </div>

        {footerCols.map((c) => (
          <div key={c.head}>
            <p className="font-display text-ink text-[0.92rem] font-bold tracking-[0.02em]">{c.head}</p>
            <ul className="mt-5 space-y-3">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link to={l.to} className="text-ink-muted hover:text-rose text-[0.92rem] transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <p className="font-display text-ink text-[0.92rem] font-bold tracking-[0.02em]">About</p>
          <p className="text-ink-muted mt-5 max-w-[32ch] text-[0.92rem] leading-[1.65]">
            Nothing here is re-hosted. Every lecture, book and series opens the original source — YouTube,
            Archive.org or Google Books — so the scholars and publishers keep their own work.
          </p>
        </div>
      </div>

      <div className="border-line/80 text-ink-muted mx-auto mt-14 flex max-w-[1180px] flex-col gap-3 border-t pt-7 text-[0.82rem] sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} ilmNet. All rights reserved.</p>
        <p className="flex items-center gap-4">
          <span className="text-ink-muted/80">Free for every seeker. No account needed.</span>
          <Link to="/admin" className="hover:text-rose transition-colors">
            Admin
          </Link>
        </p>
      </div>
    </footer>
  );
}
