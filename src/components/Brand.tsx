/**
 * IlmNet vector logos (Fase 6.1).
 *
 * `public/brand/logo/*.svg` contains transparent path-only reconstructions of the supplied branding
 * references — not an original vector master. The symbol, wordmark and descriptor are outlines;
 * they need no font, embedded bitmap or CSS drawing. See `brand/SVG_RECONSTRUCTION.md` for provenance,
 * comparisons and the limits of the low-resolution originals. PNG/WebP files remain as references,
 * but are never requested by this component.
 *
 * Keep the original artboards and placements: the 3:1 primary fits the 40px desktop header at the
 * package's 120px minimum, and the 36px mobile header at 108px. The horizontal variant's 1.86:1
 * artboard would need a taller header; selecting it must not silently redesign the navigation.
 */

type Variant =
  | 'primary'
  | 'primaryDark'
  | 'horizontal'
  | 'stacked'
  | 'smallScale'
  | 'iconOnly'
  | 'monochromeDark'
  | 'monochromeLight';

/** ViewBox dimensions match the reference artboards, reserving space without layout shift. */
const ASSETS: Record<Variant, { path: string; width: number; height: number }> = {
  primary: { path: 'ilmnet-logo-primary-light', width: 450, height: 150 },
  primaryDark: { path: 'ilmnet-logo-primary-dark', width: 345, height: 115 },
  horizontal: { path: 'ilmnet-logo-horizontal', width: 345, height: 185 },
  stacked: { path: 'ilmnet-logo-stacked', width: 310, height: 185 },
  smallScale: { path: 'ilmnet-logo-small-scale', width: 215, height: 115 },
  iconOnly: { path: 'ilmnet-logo-icon-only', width: 210, height: 185 },
  monochromeDark: { path: 'ilmnet-logo-monochrome-dark', width: 310, height: 115 },
  monochromeLight: { path: 'ilmnet-logo-monochrome-light', width: 280, height: 115 },
};

export type BrandLogoVariant = Variant;

/**
 * `className` sets a height or width on the sizing wrapper, not the image. Its explicit aspect ratio
 * avoids an intrinsic-width image stretching the header. Both `h-9 sm:h-10` and `w-32` work.
 * Use `label=""` inside an already named link; otherwise the logo's alt text names the brand.
 * `primaryDark` / `monochromeLight` need a dark host surface — the SVG never supplies a background.
 */
export function BrandLogo({
  variant = 'primary',
  className = '',
  label = 'IlmNet',
  title,
}: {
  variant?: BrandLogoVariant;
  className?: string;
  label?: string;
  title?: string;
}) {
  const asset = ASSETS[variant];
  return (
    <span
      className={`inline-block shrink-0 ${className}`}
      style={{ aspectRatio: `${asset.width} / ${asset.height}` }}
    >
      <img
        src={`/brand/logo/${asset.path}.svg`}
        alt={label}
        title={title}
        width={asset.width}
        height={asset.height}
        decoding="async"
        className="h-full w-full object-contain"
      />
    </span>
  );
}
