import type { ReactNode } from 'react';
import { Mark } from '../components/Brand';
import { useAdminAuth } from './auth';
import AdminLogin from './AdminLogin';
import { usePageMeta } from '../lib/usePageMeta';

/**
 * Guards every `/admin/*` route.
 *
 * Nothing of the CMS is mounted before the API has confirmed the session, so there is no window in
 * which admin data (drafts, imports, uploads) can be rendered without authentication. The current
 * URL is kept, so a deep link such as `/admin/lectures/…` works: sign in and the same page opens.
 */
export default function AdminGate({ children }: { children: ReactNode }) {
  const { status } = useAdminAuth();

  // Fase 5.5: the CMS and its sign-in screen must never show up in a search engine.
  usePageMeta({ title: 'Admin', noindex: true });

  if (status === 'checking') {
    return (
      <div className="bg-cream text-ink min-h-screen font-sans" data-testid="admin-gate-checking">
        <div className="mx-auto flex min-h-screen max-w-[420px] flex-col items-center justify-center gap-4 px-6 text-center">
          <span className="bg-cream neu-raised-sm grid h-12 w-12 place-items-center rounded-[16px]">
            <Mark className="h-6 w-6" />
          </span>
          <p className="font-display text-ink text-[1.15rem] font-extrabold">Checking your admin session…</p>
          <p className="text-ink-muted text-[0.88rem]">
            Your session is verified against the API before any part of the CMS is loaded.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'signed-out') return <AdminLogin />;

  return <>{children}</>;
}
