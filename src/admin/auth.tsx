import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { clearAdminToken, hasAdminToken, setAdminToken, verifyAdminSession } from '@/lib/api';

/**
 * Admin authentication state.
 *
 * The credential is the server's `ADMIN_TOKEN` (see `server/src/server.ts`): the API compares it in
 * constant time on every `/api/admin/*` request, so the browser is never the authority. This module
 * only decides *what the admin sees*: it verifies the token against the API before the CMS is
 * rendered, and it re-verifies on every page load — a refresh (or a tampered session storage) can
 * therefore never unlock the CMS by itself.
 *
 * Where the token lives: sessionStorage of this tab only (survives a refresh, gone when the tab
 * closes). Never localStorage, never a cookie, never the bundle.
 */
export type AuthStatus = 'checking' | 'signed-in' | 'signed-out';

export interface AdminAuth {
  status: AuthStatus;
  /** Why the user is on the login screen (rejected token, unreachable API, signed out). */
  message: string | null;
  /** True while a sign-in attempt is being verified against the API. */
  busy: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: (message?: string) => void;
  /** Re-run the server check (used by the retry button when the API was unreachable). */
  retry: () => void;
}

const Ctx = createContext<AdminAuth | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  /** Guards against a slow verification overwriting a newer one (or a sign-out). */
  const runId = useRef(0);

  // Every mount and every retry verifies the stored token against the API before the CMS is shown.
  useEffect(() => {
    const id = ++runId.current;
    if (!hasAdminToken()) {
      setStatus('signed-out');
      return;
    }
    setStatus('checking');
    verifyAdminSession().then((res) => {
      if (id !== runId.current) return;
      if (res.ok) {
        setStatus('signed-in');
        setMessage(null);
        return;
      }
      if (res.status === 401 || res.status === 403) {
        // The stored token is not accepted: drop it instead of keeping a dead session around.
        clearAdminToken();
        setStatus('signed-out');
        setMessage('This session was no longer accepted by the API (401). Sign in again.');
        return;
      }
      setStatus('signed-out');
      setMessage('The backend could not be reached to verify your session. Nothing was changed.');
    });
  }, [attempt]);

  const signIn = useCallback(async (token: string) => {
    const value = token.trim();
    if (!value) {
      setMessage('Enter the admin token to continue.');
      return;
    }
    const id = ++runId.current;
    setBusy(true);
    setAdminToken(value);
    const res = await verifyAdminSession();
    setBusy(false);
    if (id !== runId.current) return;
    if (res.ok) {
      setStatus('signed-in');
      setMessage(null);
      return;
    }
    // A token the server did not accept is not kept around.
    clearAdminToken();
    setStatus('signed-out');
    setMessage(
      res.status === 401 || res.status === 403
        ? 'That admin token was rejected by the API (401). Check the ADMIN_TOKEN configured on the server.'
        : 'The backend is unreachable, so the token could not be verified. Nothing was changed.'
    );
  }, []);

  const signOut = useCallback((why?: string) => {
    runId.current++;
    clearAdminToken();
    setBusy(false);
    setStatus('signed-out');
    setMessage(why ?? null);
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo<AdminAuth>(
    () => ({ status, message, busy, signIn, signOut, retry }),
    [status, message, busy, signIn, signOut, retry]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
