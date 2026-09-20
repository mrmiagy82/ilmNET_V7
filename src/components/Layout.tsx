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
      <Nav />
      <main>
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
