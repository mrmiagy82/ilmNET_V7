import { useEffect, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
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
}: {
  children: ReactNode;
  to?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
  tone?: 'rose' | 'olive' | 'sand';
}) {
  const cls =
    tone === 'rose'
      ? 'bg-rose text-cream shadow-[8px_10px_22px_rgba(204,58,99,0.26)] hover:bg-[#b83156]'
      : tone === 'olive'
        ? 'bg-olive text-[#22251a] shadow-[8px_10px_22px_rgba(140,150,100,0.32)] hover:brightness-95'
        : 'bg-sand text-ink neu-raised-sm hover:text-rose';
  const shared = `inline-flex items-center justify-center rounded-[18px] px-6 py-3 text-[0.94rem] font-semibold transition-all ${cls}`;
  if (to) {
    return (
      <Link to={to} className={shared}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} className={shared}>
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  to,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  to?: string;
  type?: 'button' | 'submit';
}) {
  const cls =
    'bg-sand text-ink neu-raised-sm inline-flex items-center justify-center rounded-[18px] px-6 py-3 text-[0.94rem] font-semibold transition-transform hover:-translate-y-0.5';
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export function StatusPill({ status }: { status: PublishStatus }) {
  return status === 'published' ? (
    <span className="bg-olive/20 text-olive-deep inline-flex rounded-full px-3 py-1 text-[0.72rem] font-semibold tracking-[0.04em] uppercase">
      Published
    </span>
  ) : (
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

export function SourcePreview({
  url,
  ok,
  expect,
}: {
  url: string;
  ok: boolean;
  expect: string;
}) {
  if (!url.trim()) return null;
  return (
    <div
      className={`mt-3 flex items-start gap-3 rounded-[18px] px-4 py-3 ${
        ok ? 'bg-olive/15' : 'bg-rose/10'
      }`}
    >
      <span
        className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
          ok ? 'bg-olive/30 text-olive-deep' : 'bg-rose/15 text-rose'
        }`}
      >
        {ok ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 8v4.5M12 16h.01" />
          </svg>
        )}
      </span>
      <div className="min-w-0">
        <p className={`text-[0.84rem] font-semibold ${ok ? 'text-olive-deep' : 'text-rose'}`}>
          {ok ? `${expect} link recognised` : `This does not look like a ${expect} URL`}
        </p>
        <p className="text-ink-muted mt-0.5 truncate text-[0.8rem]">{url}</p>
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

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Remove',
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center px-4">
      <button aria-label="Close" className="absolute inset-0 bg-[#26241f]/35" onClick={onCancel} />
      <div className="bg-cream neu-float relative w-full max-w-[440px] rounded-[28px] p-7">
        <h3 className="font-display text-ink text-[1.35rem] font-extrabold tracking-tight">{title}</h3>
        <p className="text-ink-soft mt-3 text-[0.95rem] leading-relaxed">{body}</p>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <GhostButton onClick={onCancel}>Cancel</GhostButton>
          <button
            onClick={onConfirm}
            className="bg-rose text-cream rounded-[18px] px-6 py-3 text-[0.94rem] font-semibold shadow-[8px_10px_22px_rgba(204,58,99,0.26)]"
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

export function CountLine({ n, noun }: { n: number; noun: string }) {
  return (
    <p className="text-ink-muted text-[0.86rem] font-medium">
      {n} {n === 1 ? noun : `${noun}s`} shown
    </p>
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
