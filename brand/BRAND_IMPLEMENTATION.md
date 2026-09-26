# IlmNet Brand Implementation

## Goal

Implement the approved IlmNet brand identity in the existing website without redesigning the website.

The approved logo direction is **Concept 04 — Minimal Modern**.

Use the supplied assets as the visual source of truth.

**Fase 6.1:** the website now uses transparent, path-only SVG reconstructions in
`public/brand/logo/`. The supplied PNG/WebP files remain the reference evidence, not runtime logo
fallbacks. These are reconstructed vectors, not recovered original masters; see
[`SVG_RECONSTRUCTION.md`](SVG_RECONSTRUCTION.md) for the complete set, checks and typography limits.

## Official colors

- Background: `#F3EBDD`
- Surface: `#FFFFFF`
- Primary charcoal: `#1F2933`
- Sage: `#A2AB73`
- Clay pink: `#CC3A63`

Wordmark:
- `Ilm` → `#1F2933`
- `Net` → `#CC3A63`

## Assets

Use the following files from `/public/brand/`:

- `logo/ilmnet-logo-primary-light.svg`
- `logo/ilmnet-logo-primary-dark.svg`
- `logo/ilmnet-logo-horizontal.svg`
- `logo/ilmnet-logo-stacked.svg`
- `logo/ilmnet-logo-monochrome-dark.svg`
- `logo/ilmnet-logo-monochrome-light.svg`
- `logo/ilmnet-logo-small-scale.svg`
- `logo/ilmnet-logo-icon-only.svg`
- `icon/ilmnet-icon.png`
- `favicon/favicon-16.png`
- `favicon/favicon-32.png`
- `favicon/favicon-48.png`
- `favicon/favicon-64.png`
- `favicon/apple-touch-icon.png`
- `favicon/android-chrome-192.png`
- `favicon/android-chrome-512.png`
- `social/ilmnet-profile-1080.png`
- `og/ilmnet-og-1200x630.png`

## Placement

Use:
- primary logo for the main desktop brand/header;
- horizontal logo for navigation/header contexts where horizontal space is available;
- stacked logo for centered/vertical brand placements;
- icon-only for compact UI, app icon, profile image and small spaces;
- favicon assets for browser metadata;
- monochrome variants where the UI requires one-color branding.

Do not recreate the logo in CSS.
Do not type the logo as ordinary text when a supplied logo asset is appropriate.
Do not alter proportions, colors, spacing, or add effects.

## Favicon

Set the browser favicon using the supplied favicon assets. Use the 32px version as the standard fallback and provide 16px/48px sizes where the framework supports them.

For mobile/home-screen metadata use:
- `apple-touch-icon.png`
- `android-chrome-192.png`
- `android-chrome-512.png`

## Open Graph

Use `/brand/og/ilmnet-og-1200x630.png` as the default social sharing image unless a page-specific image is intentionally supplied.

## Important source note

The original package contains raster references generated from the approved final logo-system
presentation, with opaque backgrounds/texture. It supplied neither a vector master nor a source font.
Fase 6.1 adds eight independently reconstructed SVGs: real outlines only, no embedded PNG/WebP,
no background plane, no font dependency. Existing filenames/roles and reference artboards are retained.

Do not describe those reconstructions as mathematically exact original font outlines. The readable
uppercase descriptor was cleaned up from the largest reference; the smallest raster letter details
and the original typeface cannot be authenticated. The cropped longer presentation payoff is omitted,
not invented. See `SVG_RECONSTRUCTION.md` for the precise limits and visual inspection record.

If original vector artwork is later supplied, verify it against the existing roles, palette,
transparency and layout before replacing the reconstructions.

## Do not change

Do not:
- redesign the logo;
- introduce a new icon;
- change `#CC3A63`;
- replace the official palette;
- add crescents, stars, mosques or other religious symbols;
- add gradients, 3D effects or shadows to the logo;
- create a different favicon.

## Verification

After implementation:
1. Verify the logo appears correctly on desktop and mobile.
2. Verify favicon metadata.
3. Verify light/dark usage.
4. Verify no stretching/distortion.
5. Verify all asset paths resolve.
6. Run the project's required formatting/check commands.
7. Ensure the repository contains no duplicate/obsolete logo implementations or temporary generated files.
8. Keep the final source tree clean and deployment-ready.
