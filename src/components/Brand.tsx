/**
 * IlmNet brand assets (Fase 6.0).
 *
 * The official, supplied logo files live in `public/brand/logo/` (see `brand/ASSET_MANIFEST.txt`).
 * Nothing here is drawn: every mark is one of the delivered raster assets, served as WebP with the
 * original PNG as fallback. The component only sets the size and the alt text.
 *
 * Why `primary` and not `horizontal` in the header: the package prescribes minimum widths (120 px on
 * desktop, 80 px on small screens) and the brand slot in the navigation is 40 px tall. `primary` is
 * 3:1, so 40 px tall = exactly 120 px wide — the widest of the supplied wordmark variants at that
 * height. `horizontal` (1.86:1) would need 43 px of height for its 80 px minimum and 65 px for the
 * desktop minimum, which does not fit the existing header without redesigning it.
 *
 * Deliberately not used anywhere (`brand/BRAND_IMPLEMENTATION.md` allows every variant to stay
 * available): `horizontal` (see above), `primary-dark` and the two `monochrome` variants (the UI has no
 * dark surface), `icon/ilmnet-icon.*` (no spot needs a 1024 px icon — the app icons come from the
 * supplied favicon set) and `social/ilmnet-profile-1080.png` (no social profile in this repository).
 */

type Variant = 'primary' | 'horizontal' | 'stacked' | 'smallScale' | 'iconOnly';

/** Intrinsic sizes of the delivered files — used for the width/height attributes (no layout shift). */
const ASSETS: Record<Variant, { path: string; width: number; height: number }> = {
  primary: { path: 'logo/ilmnet-logo-primary-light', width: 450, height: 150 },
  horizontal: { path: 'logo/ilmnet-logo-horizontal', width: 345, height: 185 },
  stacked: { path: 'logo/ilmnet-logo-stacked', width: 310, height: 185 },
  smallScale: { path: 'logo/ilmnet-logo-small-scale', width: 215, height: 115 },
  iconOnly: { path: 'logo/ilmnet-logo-icon-only', width: 210, height: 185 },
};

export type BrandLogoVariant = Variant;

/**
 * One supplied logo file, sized by its container.
 *
 * `className` carries the size — a height (`h-9 sm:h-10`) or a width (`w-32`) — and lands on the <img>.
 * The declared width/height attributes are the file's real pixel size, so the browser reserves the right
 * box before the image loads. Set `label=""` where the surrounding element already names the brand (the
 * header link has `aria-label="IlmNet home"`), keep the default where the logo *is* the link text.
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
  // The size lives on the <picture>, with the file's own aspect ratio: `width: auto` on a block-level
  // image does NOT follow the ratio (it fills the shrink-to-fit parent, which is the intrinsic width —
  // that silently stretched the logo to 450 px and squeezed it to the header's height). Setting the
  // ratio here means a height class (h-9) or a width class (w-32) both work, and the image fills the box
  // without distortion.
  return (
    <picture
      className={`inline-block shrink-0 ${className}`}
      style={{ aspectRatio: `${asset.width} / ${asset.height}` }}
    >
      <source srcSet={`/brand/${asset.path}.webp`} type="image/webp" />
      <img
        src={`/brand/${asset.path}.png`}
        alt={label}
        title={title}
        width={asset.width}
        height={asset.height}
        decoding="async"
        className="h-full w-full object-contain"
      />
    </picture>
  );
}
