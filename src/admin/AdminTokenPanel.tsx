import { useState } from 'react';
import { clearAdminToken, setAdminToken } from '@/lib/api';

/**
 * Admin token control.
 *
 * The token is never baked into a production bundle, so in a deployed environment the
 * operator pastes it here once. It is kept in sessionStorage for the duration of the tab
 * and sent as `x-admin-token` on every /api/admin request.
 */
export default function AdminTokenPanel({ hasToken, onChanged }: { hasToken: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  const save = () => {
    setAdminToken(value);
    setValue('');
    setOpen(false);
    onChanged();
  };

  const forget = () => {
    clearAdminToken();
    setOpen(false);
    onChanged();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="admin-token-toggle"
        className={`flex items-center gap-2 rounded-full px-4 py-2 text-[0.8rem] font-semibold transition-colors ${
          hasToken ? 'bg-cream neu-raised-sm text-olive-deep' : 'bg-rose/10 text-rose ring-1 ring-rose/30'
        }`}
        title={hasToken ? 'Admin token is ingesteld' : 'Admin token ontbreekt — schrijfacties worden geweigerd'}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="4" y="10" width="16" height="10" rx="2.5" />
          <path d={hasToken ? 'M8 10V7a4 4 0 0 1 8 0v3' : 'M8 10V7a4 4 0 0 1 7-2.6'} />
        </svg>
        {hasToken ? 'Token actief' : 'Token instellen'}
      </button>

      {open && (
        <div
          data-testid="admin-token-panel"
          className="bg-cream neu-raised absolute right-0 z-50 mt-2 w-[320px] rounded-[22px] p-4"
        >
          <p className="text-ink text-[0.86rem] font-semibold">Admin token</p>
          <p className="text-ink-muted mt-1 text-[0.74rem] leading-relaxed">
            Nodig voor alle <span className="font-mono">/api/admin</span> verzoeken in productie. Het token staat nooit in de
            gebouwde frontend en blijft alleen in deze tab (sessionStorage).
          </p>
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Plak het ADMIN_TOKEN"
            data-testid="admin-token-input"
            autoComplete="off"
            className="bg-sand neu-inset text-ink placeholder:text-ink-muted/60 mt-3 w-full rounded-[14px] px-4 py-2.5 text-[0.86rem] outline-none"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={save}
              data-testid="admin-token-save"
              className="bg-rose text-cream rounded-full px-4 py-2 text-[0.8rem] font-semibold disabled:opacity-50"
              disabled={!value.trim()}
            >
              Opslaan
            </button>
            {hasToken && (
              <button
                type="button"
                onClick={forget}
                data-testid="admin-token-clear"
                className="bg-cream neu-raised-sm text-rose rounded-full px-4 py-2 text-[0.8rem] font-semibold"
              >
                Vergeten
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
