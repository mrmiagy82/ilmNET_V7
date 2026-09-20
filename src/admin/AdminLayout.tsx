import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Mark, Wordmark } from '../components/Brand';
import { useAdmin } from './store';
import { Toast } from './ui';

const nav = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/lectures', label: 'Lectures', end: false },
  { to: '/admin/books', label: 'Books', end: false },
  { to: '/admin/scholars', label: 'Scholars', end: false },
  { to: '/admin/subjects', label: 'Subjects', end: false },
];

function NavItems({ onClick }: { onClick?: () => void }) {
  return (
    <div className="flex flex-col gap-1">
      {nav.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.end}
          onClick={onClick}
          className={({ isActive }) =>
            `rounded-[16px] px-4 py-2.5 text-[0.94rem] font-medium transition-colors ${
              isActive ? 'bg-cream text-rose neu-raised-sm' : 'text-ink-soft hover:bg-cream/70 hover:text-ink'
            }`
          }
        >
          {n.label}
        </NavLink>
      ))}
    </div>
  );
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { notice, clearNotice } = useAdmin();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setOpen(false);
  }, [pathname]);

  return (
    <div className="bg-cream text-ink min-h-screen font-sans">
      <div className="lg:grid lg:grid-cols-[250px_1fr]">
        <aside className="bg-sand hidden min-h-screen flex-col px-4 py-6 lg:flex">
          <Link to="/admin" className="mb-8 flex items-center gap-2.5 px-2">
            <span className="bg-cream neu-raised-sm grid h-10 w-10 place-items-center rounded-[14px]">
              <Mark className="h-6 w-6" />
            </span>
            <span>
              <Wordmark />
              <span className="text-ink-muted mt-1 block text-[0.68rem] font-semibold tracking-[0.18em] uppercase">
                Admin
              </span>
            </span>
          </Link>
          <NavItems />
          <div className="mt-auto px-2 pt-10">
            <Link to="/" className="text-ink-muted hover:text-rose text-[0.86rem] font-semibold transition-colors">
              View library →
            </Link>
            <p className="text-ink-muted/80 mt-3 text-[0.75rem] leading-relaxed">
              Session only. Nothing is written to a server yet.
            </p>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="bg-sand/80 sticky top-0 z-40 flex items-center justify-between px-4 py-3 backdrop-blur-xl lg:hidden">
            <Link to="/admin" className="flex items-center gap-2">
              <span className="bg-cream neu-raised-sm grid h-9 w-9 place-items-center rounded-[12px]">
                <Mark className="h-5 w-5" />
              </span>
              <span className="font-display text-ink text-[1.05rem] font-extrabold tracking-tight">
                ilmNet <span className="text-ink-muted font-semibold">Admin</span>
              </span>
            </Link>
            <button
              aria-label="Menu"
              onClick={() => setOpen((v) => !v)}
              className="bg-cream neu-raised-sm grid h-10 w-10 place-items-center rounded-[14px]"
            >
              <span className="flex flex-col gap-[5px]">
                <span className={`bg-ink block h-[2px] w-4 transition-transform ${open ? 'translate-y-[7px] rotate-45' : ''}`} />
                <span className={`bg-ink block h-[2px] w-4 transition-opacity ${open ? 'opacity-0' : ''}`} />
                <span className={`bg-ink block h-[2px] w-4 transition-transform ${open ? '-translate-y-[7px] -rotate-45' : ''}`} />
              </span>
            </button>
          </header>

          {open && (
            <div className="bg-sand px-4 py-4 lg:hidden">
              <NavItems onClick={() => setOpen(false)} />
              <Link to="/" className="text-rose mt-4 inline-block px-4 text-[0.9rem] font-semibold">
                View library →
              </Link>
            </div>
          )}

          <div className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
            <Outlet />
          </div>
        </div>
      </div>
      <Toast message={notice} onDone={clearNotice} />
    </div>
  );
}
