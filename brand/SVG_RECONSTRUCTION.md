# IlmNet — true SVG reconstruction (Fase 6.1)

**26 September 2026.** Eight transparent, path-only SVGs reconstructed from the supplied branding
package. These are new vector reconstructions, **not recovered original vector masters**. The
original PNG/WebP files, reference board and `ASSET_MANIFEST.txt` remain unchanged as provenance.

## Production assets

All files live in `public/brand/logo/`; the build copies them unchanged to `dist/brand/logo/`.
The original artboards are retained, including transparent padding, so existing placements do not
silently grow, shift or change proportions when the presentation backgrounds disappear.

| SVG | ViewBox | Foreground | Existing use |
| --- | --- | --- | --- |
| `ilmnet-logo-primary-light.svg` | `0 0 450 150` | charcoal / pink / sage | public header and footer |
| `ilmnet-logo-primary-dark.svg` | `0 0 345 115` | white / pink / sage | available for dark surfaces |
| `ilmnet-logo-horizontal.svg` | `0 0 345 185` | charcoal / pink / sage | available; not squeezed into the existing header |
| `ilmnet-logo-stacked.svg` | `0 0 310 185` | charcoal / pink / sage | admin sign-in |
| `ilmnet-logo-small-scale.svg` | `0 0 215 115` | charcoal / pink / sage | admin sidebar; no descriptor, as supplied |
| `ilmnet-logo-icon-only.svg` | `0 0 210 185` | charcoal / pink / sage | compact admin bar/session-check screen; symbol only |
| `ilmnet-logo-monochrome-dark.svg` | `0 0 310 115` | charcoal only | available for light surfaces |
| `ilmnet-logo-monochrome-light.svg` | `0 0 280 115` | white only | available for dark surfaces |

Foreground colours are exactly **`#1F2933`, `#CC3A63`, `#A2AB73`, `#FFFFFF`**, according to the variant.
The monochrome variants genuinely have one foreground colour, not raster shading in a second colour.
**`#F3EBDD` is a host-surface colour, never an SVG background fill.** White in the two light-on-dark
variants is the actual symbol/lettering, not a white artboard.

Every SVG contains only `svg`, `title`, `desc` and closed, filled `path` elements. There are no bitmap
payloads, `<image>`, `<text>`, fonts, background rectangles/planes, gradients, filters, shadows,
scripts, CSS drawings or external resources. Counters and gaps use transparent negative space.
The eight SVG files total **98,962 bytes** uncompressed.

## How the artwork was reconstructed

1. Inspect `FINAL_APPROVED_LOGO_SYSTEM_REFERENCE.png` and each of the eight corresponding PNGs.
   All supplied PNGs are opaque RGB presentation crops, not transparent production vector art.
   Card boundaries, neighbouring-tile fragments, texture and cut-off presentation text must not be
   treated as logo shapes.
2. Isolate the actual symbol and wordmark contours within each reference. Fit continuous cubic
   Bézier curves/straight segments to their subpixel boundaries, retaining each variant's own
   geometry and placement rather than replacing the wordmark with an unrelated installed font.
3. Use the palette written in the branding package, not the textured/shaded colours of individual
   screenshot pixels. Remove the presentation surfaces entirely.
4. Reconstruct **ISLAMIC KNOWLEDGE LIBRARY** as explicit filled letter outlines from the largest,
   readable primary-light reference. Keep its measured letter spacing; regularise thin stems,
   connect the diagonal strokes and reopen counters. Blind pixel tracing produced broken letters
   at 1000% and was rejected. Place the clean outline descriptor in the corresponding small variants;
   preserve the slight baseline inclination visible in the stacked reference. Small-scale and
   icon-only remain without the descriptor.
5. Render the real SVG files in Chromium at native size, 4× and 10×, compare with the originals and
   inspect transparent negative space against light/dark checkerboards. Review header/footer and
   sign-in placements on the real production build.

The analysis/curve-fitting used image tools already present in the review environment. It is not a
new project dependency or an application runtime feature. The committed SVG paths are the editable
vector source; the website does not trace, generate or recolour a logo at runtime.

## Fidelity limits — do not describe these as exact original font outlines

- **No source font or original vector master was supplied.** Symbol/wordmark silhouettes and
  composition can be matched to the raster references, but the original mathematical curves and
  exact typeface cannot be recovered or authenticated from those pixels.
- **The smallest descriptors are only about 4–6 pixels tall.** Their individual letter details are
  not reliably recoverable. The clean descriptor is a geometric reconstruction from the larger
  readable reference, fitted to each existing placement, not a claim to have identified its font.
- The references themselves differ slightly in lettering, corner rounding and alignment. Those
  variant-specific silhouettes/artboards were retained; this phase does not invent a new, uniform
  typesetting system or redesign the logo.
- The longer presentation payoff **“Knowledge. Guidance. A Brighter Tomorrow.”** is clipped at the
  bottom of the supplied primary-light crop and is not present in the other logo assets. It was not
  added as an extra lockup or traced as a clipped fragment. The uppercase descriptor **is included**.
- Vector geometry stays sharp when enlarged, but does not make a physically 2–3px-high descriptor
  readable at the existing small header/footer size. The established layout was deliberately not
  enlarged or redesigned.

**All eight requested existing variants are delivered.** What cannot be certified is exact original
font/curve identity, especially the smallest descriptor details; no variant is silently substituted
with a bitmap or omitted. Future original vector artwork should supersede these reconstructions
only after the same role, colour, transparency and placement checks.

## Integration (no backend/auth/database changes)

`src/components/Brand.tsx` is the only changed application component. It selects the SVG directly,
with no PNG/WebP `<source>` or raster fallback. The shared sizing wrapper still sets the reference
aspect ratio, and the `<img>` retains intrinsic width/height, alt text, title and async decoding.
All eight variants are selectable through `BrandLogoVariant`.

- Header: primary-light, **120 × 40px desktop / 108 × 36px mobile**, decorative alt inside the
  existing `aria-label="IlmNet home"` link.
- Footer: primary-light, **96 × 32px**, `alt="IlmNet"`.
- Admin placements: existing stacked, small-scale and icon-only roles, with the same dimensions and
  labels. No login, session, gate, store, backend or database code was changed.
- Supplied raster favicons, app/manifest icons and social assets are untouched. No new favicon or
  social-card design is part of this task.
- Existing production/CMS e2e assertions now expect the actually selected `.svg`, not a WebP source.

## Verification performed

| Check | Result |
| --- | --- |
| Root `npx tsc --noEmit` | exit 0 |
| Server `npx tsc --noEmit` | exit 0; no server source change |
| Root `npm run build` | exit 0; `index.html` 658,219 B, precompressed gzip 163,620 B |
| Syntax checks: new brand / updated production / updated CMS specs | exit 0 |
| `npm run test:e2e:brand` against the static production preview | **222/222 passed** |
| All eight SVGs opened/rendered at 100%, 400%, 1000% | 24 real browser renders; all visually reviewed against the reference crops |
| Transparency / palette / pure-path structure | all passed; all borders alpha 0; no cream/white background planes |
| Header/footer in Chromium, widths 1366 / 375 / 320px | loaded SVGs, unchanged dimensions/accessible names, no horizontal overflow |
| Real signed-out page + isolated shared component variants | passed; no fake auth context or sign-in attempted |

Visual inspection matrix (source comparison + browser-rendered artwork):

| Variant | 100% | 400% | 1000% |
| --- | --- | --- | --- |
| primary-light | reviewed | reviewed | reviewed |
| primary-dark | reviewed | reviewed | reviewed |
| horizontal | reviewed | reviewed | reviewed |
| stacked | reviewed | reviewed | reviewed |
| small-scale | reviewed | reviewed | reviewed |
| icon-only | reviewed | reviewed | reviewed |
| monochrome-dark | reviewed | reviewed | reviewed |
| monochrome-light | reviewed | reviewed | reviewed |

**Scope of the fresh tests:** a static Vite production preview, with no running API/database, plus
real component rendering. The unavailable API was not replaced with fake records, counters or an
invented signed-in session. The complete database-dependent production, CMS, auth, media and backend
runtime suites were **not rerun** in this phase; historical green totals in `docs/CONTEXT.md` are not
new results. Node 20.20.2/npm 10.8.2 were used; the existing server dependency
`content-disposition@3.0.0` advertises Node >=22 and produced an engine warning during `npm ci`.
No dependency was added/upgraded to hide it. Missing Playwright OS runtime libraries were installed
in the sandbox **with explicit user permission**, not added to the application/lockfiles.

The review also caught a test-harness lifecycle issue: `setContent` over a mounted home page leaves
its WebGL animation running. Isolated component checks now use a fresh blank document with the real
build CSS and an asset base URL; the application itself was not changed to work around the test.

## Repeat the checks

```bash
npm ci
npx tsc --noEmit
npm run build
npm run preview -- --host 0.0.0.0 --port 4173 --strictPort
# In another terminal (only existing Playwright and TypeScript dependencies are used):
SITE_URL=http://localhost:4173 npm run test:e2e:brand
```

The browser and its OS libraries must already be available (`npx playwright install chromium` /
`npx playwright install-deps chromium` are environment setup, not new app dependencies; obtain any
required permission first). `BRAND_EVIDENCE_DIR` optionally selects an output directory; by default
screenshots and `report.json` go to a temporary directory outside the checkout. The test performs no
API writes and requires no accounts or fixtures. For a full production/CMS run, use the real API,
account and published-content conditions in `docs/CONTEXT.md` §6 instead.

Delivery review artifacts are kept outside Git: the 24 transparent browser renders, original-vs-SVG
comparison boards, actual page screenshots, a standalone offline `ilmnet-vector-review.html` with
100/400/1000% and background controls, and `ilmnet-svg-set.zip`. Do not ship those PNG review captures
as application logo assets.
