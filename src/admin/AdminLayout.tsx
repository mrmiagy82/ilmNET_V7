import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Mark, Wordmark } from '../components/Brand';
import { useAdmin } from './store';
import { hasAdminToken } from '@/lib/api';
import AdminTokenPanel from './AdminTokenPanel';
import { Toast } from './ui';

const nav = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/archive-import', label: 'Archive.org Bulk', end: false },
  { to: '/admin/youtube-import', label: 'YouTube Bulk', end: false },
  { to: '/admin/lectures', label: 'Lectures', end: false },
  { to: '/admin/books', label: 'Books', end: false },
  { to: '/admin/scholars', label: 'Scholars', end: false },
  { to: '/admin/subjects', label: 'Subjects', end: false },
];

function NavItems({ onClick }: { onClick?: () => void }) {
  return (
    <div className="flex flex-col gap-1">
      {nav.map((n) => {
        const isBulk = n.to === '/admin/archive-import' || n.to === '/admin/youtube-import';
        return (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            onClick={onClick}
            className={({ isActive }) =>
              `rounded-[16px] px-4 py-2.5 text-[0.94rem] font-medium transition-colors flex items-center justify-between ${
                isActive ? 'bg-cream text-rose neu-raised-sm' : 'text-ink-soft hover:bg-cream/70 hover:text-ink'
              } ${isBulk && !isActive ? 'ring-1 ring-olive/20' : ''}`
            }
          >
            <span>{n.label}</span>
            {isBulk && <span className="bg-olive/15 text-olive-deep rounded-full px-2 py-0.5 text-[0.62rem] font-bold tracking-[0.04em] uppercase">New</span>}
          </NavLink>
        );
      })}
    </div>
  );
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const [tokenSet, setTokenSet] = useState(() => hasAdminToken());
  const { pathname } = useLocation();
  const { notice, clearNotice, refresh } = useAdmin();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setOpen(false);
  }, [pathname]);

  return (
    <div className="bg-cream text-ink min-h-screen font-sans">
      <div className="lg:grid lg:grid-cols-[268px_1fr]">
        <aside className="bg-sand hidden min-h-screen flex-col px-4 py-6 lg:flex lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
          <Link to="/admin" className="mb-6 flex items-center gap-2.5 px-2">
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

          <Link
            to="/admin/new"
            className="bg-rose text-cream mb-2 flex items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-[0.92rem] font-semibold shadow-[8px_10px_22px_rgba(204,58,99,0.26)] hover:bg-[#b83156] transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
            Add content
          </Link>
          <Link
            to="/admin/archive-import"
            className="bg-cream neu-raised-sm text-ink hover:text-rose mb-2 flex items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-[0.88rem] font-semibold transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v13" /><path d="M14 19V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z" /></svg>
            Archive.org Bulk Import
          </Link>
          <Link
            to="/admin/youtube-import"
            className="bg-cream neu-raised-sm text-ink hover:text-rose mb-6 flex items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-[0.88rem] font-semibold transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M19.615 3.184c-1.5-.105-4.95-.184-7.615-.184s-6.115.079-7.615.184C2.86 3.29 2 3.905 2 5.5v8.5c0 1.595.86 2.21 2.385 2.316 1.5.105 4.95.184 7.615.184s6.115-.079 7.615-.184C21.14 16.21 22 15.595 22 14V5.5c0-1.595-.86-2.21-2.385-2.316zM10 13v-6l6 3-6 3z" /></svg>
            YouTube Bulk Import
          </Link>

          <NavItems />

          <div className="mt-6 rounded-[20px] bg-cream neu-raised-sm p-4">
            <p className="text-ink-muted text-[0.68rem] font-semibold tracking-[0.16em] uppercase">Workflow</p>
            <ol className="mt-3 space-y-1.5 text-[0.78rem] leading-relaxed text-ink-soft">
              <li>1 — Choose type</li>
              <li>2 — Pick provider (YouTube / Archive.org)</li>
              <li>3 — Paste URL — for Archive.org collections → bulk detect</li>
              <li>4 — Preview embed</li>
              <li>5 — Fill metadata</li>
              <li>6 — Assign scholars</li>
              <li>7 — Assign subjects</li>
              <li>8 — Save as draft / publish</li>
            </ol>
            <p className="text-ink-muted/70 mt-3 text-[0.72rem]">Archive.org can be audio, video, book, document or mixed collection — not only books.</p>
          </div>

          <div className="mt-auto px-2 pt-8">
            <AdminTokenPanel hasToken={tokenSet} onChanged={() => { setTokenSet(hasAdminToken()); void refresh(); }} />
            <Link to="/" className="text-ink-muted hover:text-rose mt-4 block text-[0.86rem] font-semibold transition-colors">
              View library →
            </Link>
            <p className="text-ink-muted/80 mt-3 text-[0.75rem] leading-relaxed">
              Connected to the PostgreSQL library. Writes require the admin token in production.
            </p>
            <p className="text-ink-muted/60 mt-2 text-[0.7rem]">Public site remains free & requires no login.</p>
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
            <div className="flex items-center gap-2">
              <AdminTokenPanel hasToken={tokenSet} onChanged={() => { setTokenSet(hasAdminToken()); void refresh(); }} />
              <Link to="/admin/archive-import" className="bg-olive text-cream grid h-10 w-10 place-items-center rounded-[14px] shadow-[6px_8px_16px_rgba(140,150,100,0.28)]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v13" /><path d="M14 19V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z" /></svg>
              </Link>
              <Link to="/admin/new" className="bg-rose text-cream grid h-10 w-10 place-items-center rounded-[14px] shadow-[6px_8px_16px_rgba(204,58,99,0.24)]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
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
            </div>
          </header>

          {open && (
            <div className="bg-sand px-4 py-4 lg:hidden">
              <NavItems onClick={() => setOpen(false)} />
              <Link to="/admin/new" className="bg-rose text-cream mt-3 flex items-center justify-center gap-2 rounded-[16px] px-4 py-3 text-[0.92rem] font-semibold">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
                Add content — guided flow
              </Link>
              <Link to="/admin/archive-import" className="bg-cream neu-raised-sm mt-2 flex items-center justify-center gap-2 rounded-[16px] px-4 py-3 text-[0.88rem] font-semibold">
                Archive.org Bulk Import
              </Link>
              <Link to="/admin/youtube-import" className="bg-cream neu-raised-sm mt-2 flex items-center justify-center gap-2 rounded-[16px] px-4 py-3 text-[0.88rem] font-semibold">
                YouTube Bulk Import
              </Link>
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
