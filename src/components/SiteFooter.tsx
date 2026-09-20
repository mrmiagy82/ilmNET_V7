import { Link } from 'react-router-dom';
import { Mark, Wordmark } from './Brand';

const footerCols = [
  { head: 'Library', links: ['Lectures', 'Books', 'Series', 'New additions'] },
  { head: 'Browse', links: ['Subjects', 'Scholars', 'Collections', 'Beginners path'] },
  { head: 'About', links: ['Our approach', 'Sources & attribution', 'Contributors', 'Contact'] },
];

export default function SiteFooter() {
  return (
    <footer className="border-line/80 border-t px-5 pt-16 pb-12 sm:px-6">
      <div className="mx-auto grid max-w-[1180px] gap-12 md:grid-cols-[1.2fr_repeat(3,0.8fr)]">
        <div>
          <Link to="/" className="flex items-center gap-2.5">
            <span className="bg-sand neu-raised-sm grid h-10 w-10 place-items-center rounded-[14px]">
              <Mark className="h-6 w-6" />
            </span>
            <Wordmark />
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
                <li key={l}>
                  <Link to="/" className="text-ink-muted hover:text-rose text-[0.92rem] transition-colors">
                    {l}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
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
