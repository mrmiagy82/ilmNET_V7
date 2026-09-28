import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BrandLogo } from './Brand';

const links = [
  { label: 'Lectures', to: '/lectures' },
  { label: 'Books', to: '/books' },
  { label: 'Scholars', to: '/scholars' },
  { label: 'Subjects', to: '/subjects' },
];

/**
 * The magnifier of the search entry point (D4). Decorative: every place that renders it also has a real
 * label next to it, so a screen reader hears "Search the library", never an unlabelled graphic.
 */
function SearchGlyph({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6 sm:pt-6">
      <nav
        className={`mx-auto flex max-w-[1180px] items-center justify-between rounded-[24px] px-4 py-3 transition-all duration-500 sm:px-5 ${
          scrolled ? 'bg-cream/90 neu-raised-sm backdrop-blur-xl' : 'bg-transparent'
        }`}
      >
        <Link to="/" className="flex items-center" aria-label="IlmNet home">
          {/* brand/BRAND_IMPLEMENTATION.md: primary logo for the main header; 36 px tall on small
              screens (108 px wide) and 40 px on desktop (exactly the 120 px minimum width). */}
          <BrandLogo variant="primary" className="h-9 sm:h-10" label="" />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active = pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`rounded-full px-4 py-2 text-[0.94rem] font-medium transition-colors ${
                  active ? 'bg-sand text-rose neu-inset-sm' : 'text-ink-soft hover:bg-sand/70 hover:text-ink'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          {/* D4 (audit A6): one entry point to the whole library. A link, not a field: a second search
              box inside a fixed header would compete with the field on every page and could not show
              its own results. On a phone it lives in the menu panel below, where there is room for it. */}
          <Link
            to="/search"
            aria-label="Search the library"
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[0.94rem] font-medium transition-colors ${
              pathname.startsWith('/search') ? 'bg-sand text-rose neu-inset-sm' : 'text-ink-soft hover:bg-sand/70 hover:text-ink'
            }`}
          >
            <SearchGlyph className="h-[1.05rem] w-[1.05rem]" />
            Search
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={isHome ? '/lectures' : '/'}
            className={`lift-sm rounded-full px-5 py-2.5 text-[0.92rem] font-semibold ${
              isHome
                ? 'bg-sand text-ink neu-raised-sm hover:text-rose'
                : 'bg-rose text-cream shadow-[8px_10px_22px_rgba(204,58,99,0.26)] hover:bg-rose-deep'
            }`}
          >
            {isHome ? 'Browse library' : 'Home'}
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
              /* D2 (audit D9): the toggle states whether the panel is open and which element it controls. */
              aria-expanded={open}
              aria-controls="mobile-menu-panel"
            className="bg-sand neu-raised-sm grid h-10 w-10 place-items-center rounded-[14px] md:hidden"
          >
            <span className="flex flex-col gap-[5px]">
              <span className={`bg-ink block h-[2px] w-4 transition-transform ${open ? 'translate-y-[7px] rotate-45' : ''}`} />
              <span className={`bg-ink block h-[2px] w-4 transition-opacity ${open ? 'opacity-0' : ''}`} />
              <span className={`bg-ink block h-[2px] w-4 transition-transform ${open ? '-translate-y-[7px] -rotate-45' : ''}`} />
            </span>
          </button>
        </div>
      </nav>

      {open && (
        <div id="mobile-menu-panel" className="bg-cream neu-raised mx-auto mt-3 max-w-[1180px] rounded-[24px] p-3 md:hidden">
          {/* D4 (audit A6): the same entry point on a phone, one tap away and readable at 390 px. */}
          <Link
            to="/search"
            aria-label="Search the library"
            className={`border-line/70 flex items-center gap-3 border-b px-4 py-3.5 text-[1.05rem] font-medium ${
              pathname.startsWith('/search') ? 'text-rose' : 'text-ink'
            }`}
          >
            <SearchGlyph className="h-[1.15rem] w-[1.15rem]" />
            Search the library
          </Link>
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`border-line/70 block border-b px-4 py-3.5 text-[1.05rem] font-medium last:border-0 ${
                pathname.startsWith(l.to) ? 'text-rose' : 'text-ink'
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/"
            className="bg-rose text-cream mt-2 block rounded-[18px] px-4 py-3.5 text-center font-semibold transition-colors hover:bg-rose-deep"
          >
            Home
          </Link>
        </div>
      )}
    </header>
  );
}
