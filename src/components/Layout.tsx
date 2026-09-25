import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Nav from './Nav';
import SiteFooter from './SiteFooter';

export default function Layout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);

  return (
    <div className="bg-cream text-ink min-h-screen overflow-x-hidden font-sans">
      {/* Fase 5.5: keyboard users can jump past the navigation. Hidden until it has focus, so the
          design is unchanged for everyone else. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-full focus:bg-rose focus:px-5 focus:py-3 focus:text-[0.9rem] focus:font-semibold focus:text-cream focus:shadow-lg"
      >
        Skip to content
      </a>
      <Nav />
      {/* tabIndex={-1} makes the skip link land here in every browser (Safari/iOS included). */}
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
