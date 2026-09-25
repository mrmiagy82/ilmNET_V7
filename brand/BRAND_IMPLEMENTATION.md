# IlmNet Brand Implementation

## Goal

Implement the approved IlmNet brand identity in the existing website without redesigning the website.

The approved logo direction is **Concept 04 — Minimal Modern**.

Use the supplied assets as the visual source of truth.

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

- `logo/ilmnet-logo-primary-light.png`
- `logo/ilmnet-logo-primary-dark.png`
- `logo/ilmnet-logo-horizontal.png`
- `logo/ilmnet-logo-stacked.png`
- `logo/ilmnet-logo-monochrome-dark.png`
- `logo/ilmnet-logo-monochrome-light.png`
- `logo/ilmnet-logo-small-scale.png`
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

These logo assets are production raster references generated from the approved final logo-system presentation. A true vector master/SVG has not been supplied in this package.

Do not claim that these PNGs are SVGs or recreate them inaccurately.

If a true SVG master is later produced, replace the raster logo assets with the verified SVG while keeping the same filenames/roles where practical.

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
