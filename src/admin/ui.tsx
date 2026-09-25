import { useEffect, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Link } from 'react-router-dom';
import type { PublishStatus } from './data';

export function PageIntro({
  eyebrow,
  title,
  intro,
  action,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-[640px]">
        <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.22em] uppercase">{eyebrow}</p>
        <h1 className="text-display-xl text-ink mt-3 text-[clamp(2rem,4.4vw,3.1rem)]">{title}</h1>
        <p className="text-ink-soft mt-4 text-[1rem] leading-[1.65]">{intro}</p>
      </div>
      {action}
    </div>
  );
}

export function PrimaryButton({
  children,
  to,
  onClick,
  type = 'button',
  tone = 'rose',
  disabled,
}: {
  children: ReactNode;
  to?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  tone?: 'rose' | 'olive' | 'sand';
  disabled?: boolean;
}) {
  const cls =
    tone === 'rose'
      ? 'bg-rose text-cream shadow-[8px_10px_22px_rgba(204,58,99,0.26)] hover:bg-[#b83156]'
      : tone === 'olive'
        ? 'bg-olive text-[#22251a] shadow-[8px_10px_22px_rgba(140,150,100,0.32)] hover:brightness-95'
        : 'bg-sand text-ink neu-raised-sm hover:text-rose';
  const shared = `inline-flex items-center justify-center rounded-[18px] px-6 py-3 text-[0.94rem] font-semibold transition-all ${cls} ${disabled ? 'opacity-50 pointer-events-none' : ''}`;
  if (to) {
    return (
      <Link to={to} className={shared}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={shared}>
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  to,
  type = 'button',
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  to?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  const cls = `bg-sand text-ink neu-raised-sm inline-flex items-center justify-center rounded-[18px] px-6 py-3 text-[0.94rem] font-semibold transition-transform hover:-translate-y-0.5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`;
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

export function StatusPill({ status }: { status: PublishStatus }) {
  if (status === 'published') {
    return (
      <span className="bg-olive/20 text-olive-deep inline-flex rounded-full px-3 py-1 text-[0.72rem] font-semibold tracking-[0.04em] uppercase">
        Published
      </span>
    );
  }
  if (status === 'archived') {
    return (
      <span className="bg-rose/10 text-rose inline-flex rounded-full px-3 py-1 text-[0.72rem] font-semibold tracking-[0.04em] uppercase">
        Archived
      </span>
    );
  }
  return (
    <span className="bg-sand text-ink-muted inline-flex rounded-full px-3 py-1 text-[0.72rem] font-semibold tracking-[0.04em] uppercase">
      Draft
    </span>
  );
}

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-ink flex items-baseline gap-2 text-[0.84rem] font-semibold">
        {label}
        {required && <span className="text-rose text-[0.72rem] font-medium">Required</span>}
      </span>
      {hint && <span className="text-ink-muted mt-1 block text-[0.8rem] leading-relaxed">{hint}</span>}
      <div className="mt-2">{children}</div>
    </label>
  );
}

const inputCls =
  'bg-cream neu-inset text-ink placeholder:text-ink-muted w-full rounded-[16px] px-4 py-3 text-[0.95rem] outline-none';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} min-h-[120px] resize-y ${props.className ?? ''}`} />;
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${inputCls} appearance-none ${props.className ?? ''}`}>
      {props.children}
    </select>
  );
}

export function ChipToggle({
  options,
  selected,
  onToggle,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className={`rounded-full px-4 py-2 text-[0.84rem] font-semibold transition-all ${
              on
                ? 'bg-rose text-cream shadow-[6px_8px_16px_rgba(204,58,99,0.26)]'
                : 'bg-cream text-ink neu-raised-sm hover:-translate-y-0.5'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SourceCard({
  active,
  title,
  hint,
  icon,
  onClick,
}: {
  active: boolean;
  title: string;
  hint: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-[20px] p-4 sm:p-5 transition-all ${
        active ? 'bg-rose text-cream shadow-[8px_12px_24px_rgba(204,58,99,0.28)]' : 'bg-cream neu-raised-sm hover:-translate-y-0.5 text-ink'
      }`}
    >
      <span className={`grid h-9 w-9 place-items-center rounded-[12px] ${active ? 'bg-white/20 text-cream' : 'bg-sand text-ink-soft'}`}>{icon}</span>
      <p className={`mt-3 text-[0.95rem] font-bold leading-tight ${active ? 'text-cream' : 'text-ink'}`}>{title}</p>
      <p className={`mt-1 text-[0.78rem] leading-relaxed ${active ? 'text-cream/80' : 'text-ink-muted'}`}>{hint}</p>
    </button>
  );
}

// — Embedded previews —

export function YoutubeEmbed({ url }: { url: string }) {
  // dynamic import to avoid circular
  const getEmbed = (u: string) => {
    try {
      const parsed = new URL(u);
      const host = parsed.hostname.replace(/^www\./, '');
      const v = parsed.searchParams.get('v');
      const list = parsed.searchParams.get('list');
      if (host === 'youtu.be') {
        const id = parsed.pathname.slice(1).split('/')[0];
        if (id && list) return `https://www.youtube.com/embed/${id}?list=${list}`;
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      if (parsed.pathname.startsWith('/embed/')) return u;
      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/')[2];
        return `https://www.youtube.com/embed/${id}`;
      }
      if (parsed.pathname.includes('/playlist') && list && !v) return `https://www.youtube.com/embed/videoseries?list=${list}`;
      if (v) {
        if (list) return `https://www.youtube.com/embed/${v}?list=${list}`;
        return `https://www.youtube.com/embed/${v}`;
      }
      if (list) return `https://www.youtube.com/embed/videoseries?list=${list}`;
      return null;
    } catch {
      return null;
    }
  };
  const embed = getEmbed(url);
  if (!embed) return null;
  const isPlaylist = embed.includes('videoseries') || embed.includes('list=');
  return (
    <div className="bg-cream neu-inset overflow-hidden rounded-[20px] p-2">
      <div className="overflow-hidden rounded-[14px] bg-black">
        <div className="aspect-video w-full">
          <iframe
            src={embed}
            title={isPlaylist ? 'YouTube playlist preview' : 'YouTube video preview'}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      </div>
      <div className="flex items-center justify-between px-2 py-2.5">
        <p className="text-ink-muted flex items-center gap-1.5 text-[0.78rem] font-medium">
          <span className="bg-rose/10 text-rose grid h-6 w-6 place-items-center rounded-full">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M8 5.6c0-.9 1-1.5 1.8-1l8.1 5.1a1.2 1.2 0 0 1 0 2L9.8 17c-.8.5-1.8-.1-1.8-1V5.6Z" /></svg>
          </span>
          {isPlaylist ? 'Playlist — embedded preview' : 'Single video — embedded preview'}
        </p>
        <span className="text-ink-muted hidden text-[0.72rem] sm:inline">YouTube stays externally hosted</span>
      </div>
    </div>
  );
}

export function ArchiveEmbed({ url }: { url: string }) {
  const getEmbed = (u: string) => {
    try {
      const parsed = new URL(u);
      const host = parsed.hostname.replace(/^www\./, '');
      if (!(host === 'archive.org' || host.endsWith('.archive.org'))) return null;
      const parts = parsed.pathname.split('/').filter(Boolean);
      const idx = parts.indexOf('details');
      if (idx !== -1 && parts[idx + 1]) return `https://archive.org/embed/${parts[idx + 1]}`;
      if (parts[0] === 'embed') return u;
      if (parts.length === 1) return `https://archive.org/embed/${parts[0]}`;
      return null;
    } catch {
      return null;
    }
  };
  const embed = getEmbed(url);
  if (!embed) return null;
  return (
    <div className="bg-cream neu-inset overflow-hidden rounded-[20px] p-2">
      <div className="overflow-hidden rounded-[14px] bg-[#1a1a1a]">
        <div className="h-[420px] w-full">
          <iframe src={embed} title="Archive.org book preview" className="h-full w-full" allowFullScreen loading="lazy" />
        </div>
      </div>
      <div className="flex items-center justify-between px-2 py-2.5">
        <p className="text-ink-muted flex items-center gap-1.5 text-[0.78rem] font-medium">
          <span className="bg-olive/20 text-olive-deep grid h-6 w-6 place-items-center rounded-full">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M4 19V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v13" /><path d="M14 19V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z" /></svg>
          </span>
          Archive.org — embedded reader
        </p>
        <span className="text-ink-muted hidden text-[0.72rem] sm:inline">Scan stays on Archive.org</span>
      </div>
    </div>
  );
}

export function ExternalEmbed({ url, type }: { url: string; type: string }) {
  if (!url.trim()) return null;
  const lower = url.toLowerCase();
  const isPdf = lower.endsWith('.pdf') || lower.includes('.pdf?');
  const isGoogleBooks = url.includes('books.google');
  if (isGoogleBooks) {
    try {
      const u = new URL(url);
      const id = u.searchParams.get('id');
      const embed = id ? `https://books.google.com/books?id=${id}&printsec=frontcover&hl=en` : null;
      if (embed) {
        return (
          <div className="bg-cream neu-inset overflow-hidden rounded-[20px] p-2">
            <div className="overflow-hidden rounded-[14px] bg-white">
              <div className="h-[420px] w-full">
                <iframe src={embed} title="Google Books preview" className="h-full w-full" loading="lazy" />
              </div>
            </div>
            <p className="text-ink-muted px-2 py-2.5 text-[0.78rem]">Google Books — preview (availability depends on publisher)</p>
          </div>
        );
      }
    } catch {}
  }
  if (isPdf) {
    return (
      <div className="bg-cream neu-inset overflow-hidden rounded-[20px] p-2">
        <div className="overflow-hidden rounded-[14px] bg-[#1e1e1e]">
          <div className="h-[420px] w-full">
            <iframe src={url} title="PDF preview" className="h-full w-full" loading="lazy" />
          </div>
        </div>
        <p className="text-ink-muted px-2 py-2.5 text-[0.78rem]">PDF — direct preview. Hosted externally.</p>
      </div>
    );
  }
  // generic external
  return (
    <div className="bg-cream neu-inset rounded-[20px] p-2">
      <div className="bg-sand rounded-[14px] p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="bg-cream neu-raised-sm grid h-11 w-11 shrink-0 place-items-center rounded-[14px] text-ink-muted">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
          </span>
          <div className="min-w-0">
            <p className="font-display text-ink text-[1rem] font-bold leading-tight">External document</p>
            <p className="text-ink-muted mt-1 break-all text-[0.84rem]">{url}</p>
            <p className="text-ink-muted mt-3 text-[0.78rem]">Type: <span className="text-ink font-medium">{type}</span> · ilmNet will link to this location and not re-host it.</p>
            <a href={url} target="_blank" rel="noreferrer" className="bg-cream neu-raised-sm mt-4 inline-flex items-center rounded-full px-4 py-2 text-[0.82rem] font-semibold text-ink hover:text-rose">Open externally ↗</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkflowStepper({ step, total = 9 }: { step: number; total?: number }) {
  const labels = ['Type', 'Source', 'URL', 'Preview', 'Details', 'Scholar', 'Subjects', 'Review', 'Publish'];
  return (
    <div className="bg-sand neu-inset rounded-[24px] p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-ink-muted text-[0.72rem] font-semibold tracking-[0.18em] uppercase">Step {step} of {total}</p>
        <p className="text-ink-muted text-[0.72rem]">{Math.round((step / total) * 100)}%</p>
      </div>
      <div className="bg-cream neu-inset mt-3 h-2 overflow-hidden rounded-full">
        <div className="bg-rose h-full rounded-full transition-all duration-500" style={{ width: `${(step / total) * 100}%` }} />
      </div>
      <div className="mt-3 hidden gap-1.5 sm:flex">
        {labels.map((l, i) => (
          <span
            key={l}
            className={`flex-1 rounded-full px-2 py-1.5 text-center text-[0.68rem] font-semibold leading-none ${i + 1 === step ? 'bg-rose text-cream' : i + 1 < step ? 'bg-olive text-cream' : 'bg-cream text-ink-muted neu-raised-sm'}`}
          >
            {i + 1}. {l}
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-1.5 sm:hidden">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i + 1 === step ? 'bg-rose' : i + 1 < step ? 'bg-olive' : 'bg-cream neu-inset'}`} />
        ))}
      </div>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="bg-rose/10 text-rose rounded-[18px] px-4 py-3 text-[0.9rem] font-medium">{message}</div>
  );
}

/**
 * Confirmation dialog for destructive admin actions.
 *
 * Fase 5.3: for an irreversible action pass `requirePhrase` (the record's name). The confirm button
 * then stays disabled until the operator types that name exactly — the same rule the API enforces
 * (`?confirm=<id|slug>`), so a mis-click cannot delete a lecture, a scholar or a shelf. Actions that
 * only hide a record (archive) keep the plain one-click dialog.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Remove',
  requirePhrase,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  /** When set, the operator must type this text before the confirm button unlocks. */
  requirePhrase?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (!open) return;
    setTyped('');
  }, [open, requirePhrase]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  const phraseOk = !requirePhrase || typed.trim() === requirePhrase.trim();
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center px-4">
      <button aria-label="Close" className="absolute inset-0 bg-[#26241f]/35" onClick={onCancel} />
      <div className="bg-cream neu-float relative w-full max-w-[440px] rounded-[28px] p-7">
        <h3 className="font-display text-ink text-[1.35rem] font-extrabold tracking-tight">{title}</h3>
        <p className="text-ink-soft mt-3 text-[0.95rem] leading-relaxed">{body}</p>
        {requirePhrase && (
          <div className="mt-5">
            <label className="text-ink-muted text-[0.78rem] font-semibold" htmlFor="confirm-phrase">
              Type “{requirePhrase}” to confirm
            </label>
            <input
              id="confirm-phrase"
              data-testid="confirm-phrase"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="border-sand bg-cream text-ink mt-2 w-full rounded-[16px] border px-4 py-2.5 text-[0.92rem] outline-none"
            />
          </div>
        )}
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <GhostButton onClick={onCancel}>Cancel</GhostButton>
          <button
            onClick={onConfirm}
            disabled={!phraseOk}
            className={`bg-rose text-cream rounded-[18px] px-6 py-3 text-[0.94rem] font-semibold shadow-[8px_10px_22px_rgba(204,58,99,0.26)] ${
              phraseOk ? '' : 'cursor-not-allowed opacity-45'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onDone, 2600);
    return () => window.clearTimeout(t);
  }, [message, onDone]);
  if (!message) return null;
  return (
    <div className="bg-night text-cream neu-dark-raised pointer-events-none fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full px-5 py-3 text-[0.88rem] font-medium">
      {message}
    </div>
  );
}

export function EmptyRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-cream neu-inset rounded-[24px] px-6 py-14 text-center">
      <p className="font-display text-ink text-[1.15rem] font-extrabold">{title}</p>
      <p className="text-ink-muted mt-2 text-[0.92rem]">{body}</p>
    </div>
  );
}

/**
 * Honest counting: `total` is the real database count (`pagination.total`) and may be larger than
 * what this table has loaded. It is only shown when it is known — never as a stand-in `0`.
 */
export function CountLine({ n, noun, total }: { n: number; noun: string; total?: number | null }) {
  return (
    <p className="text-ink-muted text-[0.86rem] font-medium">
      {n} {n === 1 ? noun : `${noun}s`} shown
      {typeof total === 'number' && total > n ? (
        <span className="text-ink-muted/70"> · {total} in the database</span>
      ) : null}
    </p>
  );
}

/**
 * The status transitions the admin offers for one record. Archived records are restorable but never
 * jump back to the public site in one click — restoring returns them to draft first.
 */
export function statusActions(
  status: PublishStatus,
  handlers: { publish: () => void; unpublish: () => void; archive: () => void; restore: () => void }
): { key: string; label: string; onClick: () => void }[] {
  if (status === 'published') {
    return [
      { key: 'unpublish', label: 'Unpublish', onClick: handlers.unpublish },
      { key: 'archive', label: 'Archive', onClick: handlers.archive },
    ];
  }
  if (status === 'archived') {
    return [{ key: 'restore', label: 'Restore to draft', onClick: handlers.restore }];
  }
  return [
    { key: 'publish', label: 'Publish', onClick: handlers.publish },
    { key: 'archive', label: 'Archive', onClick: handlers.archive },
  ];
}

/** Placeholder rows while the admin is still loading — never an empty-looking table. */
export function LoadingRows({ rows = 4, label = 'Loading from the database…' }: { rows?: number; label?: string }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      <p className="text-ink-muted text-[0.86rem] font-medium">{label}</p>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-cream neu-raised rounded-[24px] p-5">
          <div className="bg-sand h-4 w-[45%] animate-pulse rounded-full" />
          <div className="bg-sand/70 mt-3 h-3 w-[70%] animate-pulse rounded-full" />
          <div className="bg-sand/50 mt-3 h-3 w-[30%] animate-pulse rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** The admin could not load its data — say why instead of showing an empty library. */
export function ErrorRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-rose/10 rounded-[24px] px-6 py-14 text-center">
      <p className="font-display text-ink text-[1.15rem] font-extrabold">{title}</p>
      <p className="text-ink-soft mt-2 text-[0.92rem]">{body}</p>
    </div>
  );
}

export function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="text-ink-muted hover:bg-sand hover:text-ink grid h-9 w-9 place-items-center rounded-full transition-colors"
    >
      {children}
    </button>
  );
}

export function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20Z" />
      <path d="m14.5 5 4.5 4.5" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M5 7h14M10 7V5h4v2M8 7l.8 12h6.4L16 7" />
    </svg>
  );
}

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-cream neu-raised overflow-hidden rounded-[28px]">
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export const thCls =
  'text-ink-muted px-5 py-3.5 text-left text-[0.7rem] font-semibold tracking-[0.16em] uppercase';
export const tdCls = 'text-ink px-5 py-4 align-middle text-[0.9rem]';
export const trCls = 'border-line/60 border-t';
