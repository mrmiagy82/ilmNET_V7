import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mark, Wordmark } from '../components/Brand';
import { useAdminAuth } from './auth';

/**
 * Admin sign-in (Fase 4.5).
 *
 * Username + password against `POST /api/admin/login`; the API returns a server-side session as an
 * `HttpOnly` cookie, so the browser stores no credential of its own — not in localStorage, not in
 * sessionStorage, not in the bundle. The public library needs no login at all.
 */
export default function AdminLogin() {
  const { signIn, busy, message, retry } = useAdminAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void signIn(username, password);
  };

  return (
    <div className="bg-cream text-ink min-h-screen font-sans" data-testid="admin-login">
      <div className="mx-auto flex min-h-screen max-w-[520px] flex-col justify-center px-5 py-12">
        <div className="flex items-center gap-2.5">
          <span className="bg-cream neu-raised-sm grid h-11 w-11 place-items-center rounded-[14px]">
            <Mark className="h-6 w-6" />
          </span>
          <span>
            <Wordmark />
            <span className="text-ink-muted mt-1 block text-[0.68rem] font-semibold tracking-[0.18em] uppercase">
              Admin sign-in
            </span>
          </span>
        </div>

        <section className="bg-cream neu-raised mt-8 rounded-[32px] p-6 sm:p-8">
          <h1 className="font-display text-ink text-[1.6rem] font-extrabold tracking-[-0.02em]">Sign in to the CMS</h1>
          <p className="text-ink-soft mt-3 text-[0.94rem] leading-relaxed">
            This is the ilmNet content desk. The public library stays free and needs no login — only
            <span className="text-ink font-semibold"> /admin</span> and the admin API are protected.
          </p>

          {message ? (
            <div
              data-testid="admin-login-message"
              className="bg-rose/10 text-rose mt-6 rounded-[18px] px-4 py-3 text-[0.9rem] font-medium"
            >
              {message}
            </div>
          ) : null}

          <form className="mt-6" onSubmit={submit}>
            <label className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.16em] uppercase" htmlFor="admin-username">
              Username
            </label>
            <div className="bg-sand neu-inset mt-2 rounded-[18px] px-4 py-2.5">
              <input
                id="admin-username"
                data-testid="admin-login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your admin username"
                autoComplete="username"
                autoFocus
                spellCheck={false}
                className="text-ink placeholder:text-ink-muted/60 w-full bg-transparent text-[0.95rem] outline-none"
              />
            </div>

            <label
              className="text-ink-muted mt-5 block text-[0.72rem] font-semibold tracking-[0.16em] uppercase"
              htmlFor="admin-password"
            >
              Password
            </label>
            <div className="bg-sand neu-inset mt-2 flex items-center gap-2 rounded-[18px] px-4 py-2.5">
              <svg viewBox="0 0 24 24" className="text-ink-muted h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="4" y="10" width="16" height="10" rx="2.5" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              <input
                id="admin-password"
                data-testid="admin-login-password"
                type={reveal ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="your password"
                autoComplete="current-password"
                spellCheck={false}
                className="text-ink placeholder:text-ink-muted/60 w-full bg-transparent text-[0.95rem] outline-none"
              />
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                className="text-ink-muted hover:text-ink shrink-0 text-[0.76rem] font-semibold"
                aria-label={reveal ? 'Hide password' : 'Show password'}
              >
                {reveal ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-ink-muted mt-2 text-[0.76rem] leading-relaxed">
              Your password is checked on the server (scrypt) and exchanged for a session cookie —
              this browser stores no credential, and signing out ends the session on the server.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="submit"
                data-testid="admin-login-submit"
                disabled={busy || !username.trim() || !password}
                className="bg-rose text-cream rounded-[18px] px-6 py-3 text-[0.95rem] font-semibold shadow-[8px_10px_22px_rgba(204,58,99,0.26)] transition-colors hover:bg-[#b83156] disabled:opacity-50"
              >
                {busy ? 'Checking…' : 'Sign in'}
              </button>
              <button
                type="button"
                onClick={retry}
                data-testid="admin-login-retry"
                className="bg-cream neu-raised-sm text-ink-soft hover:text-rose rounded-[18px] px-5 py-3 text-[0.88rem] font-semibold transition-colors"
              >
                Check access again
              </button>
            </div>
          </form>
        </section>

        <p className="text-ink-muted mt-6 text-center text-[0.82rem]">
          <Link to="/" className="hover:text-rose font-semibold">
            ← Back to the public library
          </Link>
        </p>
      </div>
    </div>
  );
}
