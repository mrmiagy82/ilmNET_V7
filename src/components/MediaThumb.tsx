import { useState, type ReactNode } from 'react';
import AudioPlaceholder from './AudioPlaceholder';
import type { MediaKind } from '@/lib/thumbnail';

type Props = {
  src: string | null;
  kind?: MediaKind;
  alt?: string;
  /** container classes — the frame (aspect ratio, rounding, backgrounds) */
  className?: string;
  imgClassName?: string;
  /** fallback layer shown when there is no image, or when the image fails to load */
  fallback?: ReactNode;
  /** overlays (badges, buttons) rendered on top of the image */
  children?: ReactNode;
  eager?: boolean;
  testId?: string;
};

/**
 * Thumbnail / cover frame.
 *
 * The fallback layer is always rendered *behind* the image, so a broken custom upload
 * (deleted file, dead provider URL) degrades to the ilmNet placeholder instead of an
 * empty or broken-image frame. The image itself is fixed inside the frame with
 * `object-cover`, so any aspect ratio from a provider fits without stretching.
 */
export default function MediaThumb({
  src,
  kind = 'image',
  alt = '',
  className = '',
  imgClassName = 'object-cover',
  fallback,
  children,
  eager = false,
  testId,
}: Props) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  const fallbackLayer =
    kind === 'placeholder-audio' ? (
      <AudioPlaceholder className="absolute inset-0" />
    ) : (
      fallback ?? <div className="absolute inset-0 bg-gradient-to-br from-olive/15 to-rose/15" />
    );

  return (
    <div data-testid={testId} className={`relative overflow-hidden ${className}`}>
      {fallbackLayer}
      {src && (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          onError={() => setFailed(true)}
          data-testid={testId ? `${testId}-img` : undefined}
          className={`absolute inset-0 h-full w-full ${imgClassName} ${showImage ? '' : 'hidden'}`}
        />
      )}
      {children}
    </div>
  );
}
