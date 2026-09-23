import { useRef, useState } from 'react';
import { assetUrl, isCustomMediaUrl, uploadImage } from '@/lib/api';

type Props = {
  /** current stored value (custom upload path, provider URL or empty) */
  value: string;
  onChange: (url: string) => void;
  title?: string;
  /** provider thumbnail that would be used when no custom image is set */
  providerUrl?: string | null;
  label?: string;
  hint?: string;
  shape?: 'thumb' | 'cover';
  testId?: string;
};

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif';

function describeBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Admin CMS media picker — upload a custom thumbnail/cover image.
 * The uploaded image is stored via /api/admin/uploads and its URL is saved on the Content
 * record (thumbnailUrl / coverUrl). A custom image always wins over provider thumbnails.
 */
export default function MediaField({
  value,
  onChange,
  title,
  providerUrl,
  label = 'Thumbnail / cover image',
  hint,
  shape = 'thumb',
  testId = 'media-field',
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploaded, setUploaded] = useState<{ filename: string; bytes: number } | null>(null);

  const custom = isCustomMediaUrl(value);
  const previewSrc = assetUrl(value || null) ?? assetUrl(providerUrl ?? null);

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file (jpg, png, webp, gif or avif).');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`Image is ${describeBytes(file.size)} — maximum is 5 MB.`);
      return;
    }
    setBusy(true);
    try {
      const res = await uploadImage(file);
      setUploaded({ filename: res.filename, bytes: res.bytes });
      onChange(res.url);
    } catch (e: any) {
      setError(e?.message ?? 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const box = shape === 'cover' ? 'h-[132px] w-[99px]' : 'h-[96px] w-[152px]';

  return (
    <div data-testid={testId}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-ink text-[0.86rem] font-semibold">{label}</p>
          <p className="text-ink-muted mt-0.5 text-[0.76rem]">
            {hint ?? 'Optional. A custom upload always takes priority over the automatic provider thumbnail.'}
          </p>
        </div>
        {custom && <span className="bg-olive/15 text-olive-deep shrink-0 rounded-full px-3 py-1 text-[0.68rem] font-bold">Custom · priority</span>}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`bg-sand/60 mt-3 flex gap-4 rounded-[18px] p-3 transition-colors ${dragging ? 'ring-2 ring-rose/40' : ''}`}
      >
        <div className={`${box} bg-sand-deep neu-inset shrink-0 overflow-hidden rounded-[10px] grid place-items-center`}>
          {previewSrc ? (
            <img
              src={previewSrc}
              alt={title ?? 'Preview'}
              className="h-full w-full object-cover"
              onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
            />
          ) : (
            <svg viewBox="0 0 24 24" className="text-ink-muted/60 h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <circle cx="9" cy="10" r="2" />
              <path d="m4 18 5.5-5.5 4 4L17 13l3 3" />
            </svg>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              data-testid="media-upload-button"
              className="bg-cream neu-raised-sm text-ink rounded-full px-4 py-2 text-[0.8rem] font-semibold disabled:opacity-60"
            >
              {busy ? 'Uploading…' : custom ? 'Replace image' : 'Upload image'}
            </button>
            {custom && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setUploaded(null);
                }}
                data-testid="media-remove-button"
                className="bg-cream neu-raised-sm text-rose rounded-full px-4 py-2 text-[0.8rem] font-semibold"
              >
                Remove custom
              </button>
            )}
            {!custom && providerUrl && (
              <button
                type="button"
                onClick={() => onChange(providerUrl)}
                data-testid="media-use-provider-button"
                className="bg-cream neu-raised-sm text-ink-soft rounded-full px-4 py-2 text-[0.8rem] font-semibold"
              >
                Use provider thumbnail
              </button>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            data-testid="media-file-input"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />

          <p className="text-ink-muted mt-2 break-all text-[0.72rem]">
            {value ? (
              <>
                Saved value: <span className="font-mono text-[0.68rem]">{value}</span>
                {custom && <span className="text-olive-deep font-semibold"> · custom upload (wins on the public site)</span>}
              </>
            ) : providerUrl ? (
              <>
                No custom image — public site uses the provider thumbnail: <span className="font-mono break-all text-[0.68rem]">{providerUrl}</span>
              </>
            ) : (
              <>No image — public site falls back to the ilmNet placeholder.</>
            )}
          </p>
          {uploaded && <p className="text-olive-deep mt-1 text-[0.72rem]">Uploaded {uploaded.filename} ({describeBytes(uploaded.bytes)}).</p>}
          {error && <p className="text-rose mt-1 text-[0.74rem] font-medium">{error}</p>}
        </div>
      </div>

      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…or paste an image URL"
        inputMode="url"
        data-testid="media-url-input"
        className="bg-sand neu-inset text-ink placeholder:text-ink-muted/60 mt-3 w-full rounded-[14px] px-4 py-3 text-[0.86rem] outline-none"
      />
    </div>
  );
}
