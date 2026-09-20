import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mark, Wordmark } from './Brand';

const links = [
  { label: 'Lectures', to: '/lectures' },
  { label: 'Books', to: '/books' },
  { label: 'Scholars', to: '/scholars' },
  { label: 'Subjects', to: '/subjects' },
];

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
        className={`mx-auto flex max-w-[1180px] items-center justify-between rounded-[26px] px-4 py-3 transition-all duration-500 sm:px-5 ${
          scrolled ? 'bg-cream/85 neu-raised-sm backdrop-blur-xl' : 'bg-transparent'
        }`}
      >
        <Link to="/" className="flex items-center gap-2.5" aria-label="ilmNet home">
          <span className="bg-sand neu-raised-sm grid h-10 w-10 place-items-center rounded-[14px]">
            <Mark className="h-6 w-6" />
          </span>
          <Wordmark />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active = pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`rounded-full px-4 py-2 text-[0.94rem] font-medium transition-colors ${
                  active ? 'bg-sand text-rose' : 'text-ink-soft hover:bg-sand/70 hover:text-ink'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={isHome ? '/lectures' : '/'}
            className={`rounded-full px-5 py-2.5 text-[0.92rem] font-semibold transition-colors ${
              isHome
                ? 'bg-sand text-ink neu-raised-sm hover:text-rose'
                : 'bg-rose text-cream shadow-[8px_10px_22px_rgba(204,58,99,0.26)]'
            }`}
          >
            {isHome ? 'Browse library' : 'Home'}
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
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
        <div className="bg-cream neu-raised mx-auto mt-3 max-w-[1180px] rounded-[26px] p-3 md:hidden">
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
            className="bg-rose text-cream mt-2 block rounded-[18px] px-4 py-3.5 text-center font-semibold"
          >
            Home
          </Link>
        </div>
      )}
    </header>
  );
}
