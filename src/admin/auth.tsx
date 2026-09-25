import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { adminLogin, adminLogout, fetchAdminSession, type AdminUser } from '@/lib/api';

/**
 * Admin authentication state (Fase 4.5).
 *
 * The credential never touches the browser's storage: signing in posts the username + password to
 * `POST /api/admin/login`, the API creates a server-side session and returns it as an `HttpOnly`,
 * `Secure`, `SameSite=Lax` cookie. This module only decides *what the admin sees* — it asks
 * `GET /api/admin/session` before the CMS is rendered and re-asks on every page load, so a refresh
 * or a revoked session can never unlock the CMS by itself.
 */
export type AuthStatus = 'checking' | 'signed-in' | 'signed-out';

export interface AdminAuth {
  status: AuthStatus;
  /** The signed-in operator (`null` while checking, signed out, or in legacy token mode). */
  user: AdminUser | null;
  /** How the API authorised this browser: a real session, or the legacy `ADMIN_TOKEN` fallback. */
  method: 'session' | 'token' | 'localhost' | null;
  /** Why the user is on the login screen (rejected credentials, unreachable API, signed out). */
  message: string | null;
  /** True while a sign-in attempt is being verified against the API. */
  busy: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: (message?: string) => void;
  /** Re-run the server check (used by the retry button when the API was unreachable). */
  retry: () => void;
}

const Ctx = createContext<AdminAuth | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [user, setUser] = useState<AdminUser | null>(null);
  const [method, setMethod] = useState<AdminAuth['method']>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  /** Guards against a slow verification overwriting a newer one (or a sign-out). */
  const runId = useRef(0);

  // Every mount and every retry asks the API who we are before the CMS is shown.
  useEffect(() => {
    const id = ++runId.current;
    setStatus('checking');
    fetchAdminSession().then((res) => {
      if (id !== runId.current) return;
      if (res.ok && res.session?.authenticated) {
        setUser(res.session.user ?? null);
        setMethod(res.session.method);
        setStatus('signed-in');
        setMessage(null);
        return;
      }
      setUser(null);
      setMethod(null);
      setStatus('signed-out');
      if (res.status === 401 || res.status === 403) {
        // No session (a fresh visit, an expired one, or a revoked one): the login screen is enough,
        // no alarming copy. A session that dies mid-use gets its message from the store's 401 path.
        setMessage(null);
        return;
      }
      setMessage('The backend could not be reached to verify your session. Nothing was changed.');
    });
  }, [attempt]);

  const signIn = useCallback(async (username: string, password: string) => {
    const name = username.trim();
    if (!name || !password) {
      setMessage('Enter both a username and a password.');
      return;
    }
    const id = ++runId.current;
    setBusy(true);
    try {
      const signedIn = await adminLogin(name, password);
      if (id !== runId.current) return;
      setUser(signedIn);
      setMethod('session');
      setStatus('signed-in');
      setMessage(null);
    } catch (e: any) {
      if (id !== runId.current) return;
      setUser(null);
      setMethod(null);
      setStatus('signed-out');
      setMessage(
        typeof e?.status === 'number' && e.status < 500
          ? e.message
          : 'The backend is unreachable, so you could not be signed in. Nothing was changed.',
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const signOut = useCallback((why?: string) => {
    runId.current++;
    setUser(null);
    setMethod(null);
    setBusy(false);
    setStatus('signed-out');
    setMessage(why ?? null);
    // Destroy the session server-side as well; a failure here still leaves the browser signed out.
    void adminLogout();
  }, []);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const value = useMemo<AdminAuth>(
    () => ({ status, user, method, message, busy, signIn, signOut, retry }),
    [status, user, method, message, busy, signIn, signOut, retry]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
