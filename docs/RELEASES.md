# ilmNet — Release register (Development → Staging → Production)

**Status:** living document. One entry per release, appended top-down (newest first).
**Rule:** `docs/ENVIRONMENTS.md` §6. A release is documented by **facts**: commands that ran, the
numbers they printed, and the commit hashes involved. "Should be fine" is not an entry.
**Never record** tokens, passwords, connection strings with credentials or `.env` contents — the
hostnames, paths and results are enough. This register is committed, so it is public to everyone with
repository access.

---

## How to write an entry

Copy this block for every release and delete nothing; write `not done` where something was not done,
with the reason. A release that skipped staging is a release with a **deviation**, and the deviation is
the most important line in the entry.

```markdown
## <yyyy-mm-dd> — <release name> (`<commit sha>`, short subject)

| | |
| --- | --- |
| What moved | development → staging → production: <one line per platform change> |
| Development | `npx tsc --noEmit` … · suites: <suite> <passed>/<total> · build: dist/index.html <bytes> B, sha256 `<first 16 hex>` |
| Artifact | the exact build deployed to staging and production (same sha256); served by the API |
| Staging | deployed <time> to <host> · `deploy-check --expect-commit <sha> --expect-environment staging`: <result> · browser suites: … · API suites: … |
| Production | deployed <time> to <host> · `deploy-check --expect-environment production`: <result> · smoke: <pages checked, result> |
| Rollback | previous release `<sha>`; rehearsed yes/no |
| Deviations | what was not tested/verified, why, and the risk (or: none) |
```

Per-command record that belongs in the entry (from `docs/ENVIRONMENTS.md` §5):

| Step | Command | Evidence to copy into the entry |
| --- | --- | --- |
| Typecheck (front + server) | `npx tsc --noEmit`, `cd server && npx tsc --noEmit` | exit code, no output |
| Suites | `cd server && npm run test:all && npm run test:environment` | the banner line (environment + target) and `n/total` per suite |
| Build | `npm run build` | `dist/index.html` and `.gz` size, `sha256sum` |
| Staging identity | `BASE_URL=… ops/deploy-check.sh --expect-commit … --expect-environment staging` | all checks `ok`, incl. check 11 (robots) and 12 (environment + noindex) |
| Staging browser | `SITE_URL=… npm run test:e2e:production` (+ `cms`, `auth`, `brand`) | passed/failed counts |
| Production identity | `BASE_URL=… ops/deploy-check.sh --expect-commit … --expect-environment production` | all checks `ok` |
| Production smoke | `ops/healthcheck.sh` + manual pass (home, lecture, book, series, scholar, `/admin`) | health JSON `environment`, watchdog exit code |

---

## Releases

### 2026-09-26 — D2 bibliotheek-discovery op `/lectures` en `/books` — `c1a8aba` — **verified in development, not yet deployed**

|||
| --- | --- |
| What moved | frontend only, **visible**: `/lectures` en `/books` zijn discoverypagina's geworden. Beide planken halen 24 items per pagina (`limit=24&page=N` op het bestaande `GET /api/contents`) en bieden **Load more** met de eerlijke regel “Showing 24 of 45”, in plaats van de stille `limit=100` die de lijst na 100 records liet stoppen en de tellers onderrapporteerde (audit A5). De kopteller en de resultaatregel komen uit `pagination.total`; de regel zegt ook wat er werkelijk op het scherm staat. Nieuwe secties: een **“Newest first”**-strip (12 items, `sort=publishedAt:desc`) die alleen verschijnt als het schap groter is dan één pagina — en dan ook pas data ophaalt — en een **series/collecties-rail** uit `groupByCollection` over de geladen set, met de ondertitel “Grouped from the N items loaded in this view” (geen verzonnen volledigheid, volgorde of afleveringnummers). Verder: één gedeeld filterpaneel (`LibraryFilters`, chips inklapbaar op mobiel achter een echte disclosure), één loading/error/empty-pad (`ListStates`), één retry die opnieuw ophaalt in plaats van de pagina te herladen, echte subjectnamen in de chips (geen `replace(/ &.*/, '')`), hetzelfde label **Format** op beide planken, `aria-pressed` op de chips en `aria-expanded`/`aria-controls` op de disclosure en het mobiele menu (audit A5, B1–B6, D6, D9, D11 op deze twee pagina’s). Nieuw in deze fase: `src/lib/usePagedContentQuery.ts`, `src/components/LibraryFilters.tsx`, `src/components/ListStates.tsx`, `src/lib/useFilterOptions.ts`; `Rail.tsx` exporteert `RAIL_SLOT` zodat landings- en bibliotheekrails dezelfde kaartbreedtes delen. In `src/lib/useContentQuery.ts` is een **echte fout gedicht**: een request die buiten de app om werd afgebroken werd als “geannuleerd” weggegooid, waardoor de pagina eeuwig op haar laadtoestand bleef staan en een bezoeker niet kon herstellen (zie `docs/CONTEXT.md` §8 punt 24). Analyse, keuzes en bewijs: `docs/CONTEXT.md` §7s |
| Development | `npx tsc --noEmit` schoon (root én `server/`) · `npm run build` ok, en een herbouw uit dezelfde bron gaf **byte-identiek** hetzelfde `dist/index.html` (sha256 vergeleken) · eigen browserharnas **47/47** tegen een productie-geconfigureerde instance (`ENVIRONMENT=production NODE_ENV=production` op `127.0.0.1:3111`, zonder `.env`) met de wegwerp-database `ilmnet_d2_scratch` op schaal (45 lectures / 13 boeken gepubliceerd): kopteller == `pagination.total` én == een directe API-telling, precies één pagina kaarten per lading, Load more → volledige set met de knop die verdwijnt, de claim van de pagina == de DOM, de nieuwste-strip echt op `publishedAt` gesorteerd, de serie-rail met zijn herkomst vermeld, geen “Show all” zonder bestemming, `aria-pressed` op de chips, de foutkaart in bezoekerstaal met een retry die niet herlaadt, 390×844 zonder horizontale overflow (ook met het paneel open) en Load more dat op een telefoon werkt · `test:e2e:production` **105 pass / 3 fail** — dezelfde twee medafixture-gaten en dezelfde pre-existing `TypeError … 'slug'` als vóór D2; de D2-relevante pins (laadtoestand van `/lectures`, “Could not load…” en de retry-actie) zijn groen · `test:e2e:brand` **222/222** · `test:e2e:cms` **39 pass / 0 fail** · `test:e2e:auth` **60 pass / 0 fail** · `server: npm run test:all` **409 checks, 0 fail** (identiek aan de D1-baseline; uploads 30/30, production 163/163, env-hardening 13/13, environment 38/38, ops 21/21, auth 69/69) · `test:e2e:media` kan op de seed niet starten (de suite eist een archive-audio met een `item--file`-identifier die de seed niet heeft); met een wegwerp-fixture in de wegwerp-database liep hij door met **21 pass / 6 fail**, waarbij de D2-relevante pin groen is en de zes rode checks de echte-afspeelcontroles zijn — zie `docs/CONTEXT.md` §8 punt 25 |
| Artifact | single-file `dist/index.html` **667 891 B** (sha256 `9d0abdabc262157bac13f3dcd61dd6fca58cf3dd40d40e42a3d3afa51da06dff`) / `dist/index.html.gz` **167 375 B** — +3 274 B over D1. De suites en het harnas hierboven draaiden tegen dit exacte bestand; de hash is reproduceerbaar uit de bron |
| Staging | **not done** — er is nog steeds geen staginghost (dezelfde afwijking als elke entry hieronder). De productievorm is lokaal nagebootst: `ENVIRONMENT=production NODE_ENV=production` op `127.0.0.1:3111`, gestart zonder `.env`, `FRONTEND_DIR` naar deze build; `/api/health` meldde `production (source: process) · release 1.0.0` |
| Production | **not done** — volgt op staging; de productie-geconfigureerde instance serveerde deze build voor alle controles hierboven |
| Rollback | vorige release `8d5a27f` (D1 + de vastlegging van de muterende-suitebevinding); niet geoefend (niets uitgerold). Frontend-only: de commit terugdraaien herstelt de vorige bundle. Draaiboek voor de staging/DB-kant staat in `docs/DEPLOYMENT.md` |
| Deviations | (1) **geen staginghost**, dus deze release kan onder de environmentregel niet “klaar” heten; (2) `test:e2e:media` is niet op de seed te draaien (datavoorwaarde, geen regressie) en zijn afspeelcontroles kunnen met een gefabriceerde Archive-identifier niet groen worden — de D2-relevante pin is wel bewezen; (3) de overige zes `limit=100`-plekken uit audit A5 (`SubjectDetail`, `SeriesDetail`, `Scholars`, `Subjects`, `components/Subjects.tsx`) en de filterpanelen van `Scholars`/`Subjects` horen bij D3–D5 en zijn hier bewust niet aangeraakt; (4) geen populariteits-, trending- of gepersonaliseerde rail: er is geen echt signaal, dus geen rail |

### 2026-09-26 — D1 landing discovery rails — `0494fbc` — **verified in development, not yet deployed**

|||
| --- | --- |
| What moved | frontend only, **visible**: the landing page now opens with four real content rails — New in the library (`sort=publishedAt:desc`, whole library), Newest lectures (`type=lecture,video,audio`), Newest books (`type=book,document`), Scholars (`/api/scholars`) — each one request, each hiding itself on failure or an empty answer, each with an API-sourced count, real horizontally scrollable cards and an accessible paging control. `Rail` gained `bleed`, `align` and the scroll buttons; `cards.tsx` gained `ContentCard`/`isBookType`; `ScholarTile` became a real destination (its own filtered lectures, audit A2); the mislabelled scholar block on the landing was removed (audit A1). Analysis, decisions and evidence: `docs/CONTEXT.md` §7r (that section shipped in `0494fbc`; this register entry is the follow-up commit) |
| Development | `npx tsc --noEmit` clean (root + `server/`) · `npm run build` ok · D1 browser harness against the real API and database: **35/35** (per rail: cards == API answer, subtitle == `pagination.total`, “Show all” → the page that exists; failure injection on each endpoint removes that rail and only that rail, never a “0 items”; scroll buttons with `aria-label`, disabled end states, real scrolling; scholar tile → `/lectures?scholar=<slug>` with the exact API count; 390×844 without horizontal overflow) · `test:e2e:production` **105 pass / 3 fail** — the same two media fixture gaps and the pre-existing `TypeError … 'slug'` as before D1 · `test:e2e:brand` **222/222** · `server: npm run test:all` **409 checks, 0 fail** (uploads 30/30, production 163/163, env-hardening 13/13, environment 38/38, ops 21/21, auth 69/69) · measured cost of the landing page: **9 API requests, 55.3 kB** in one page view (the three new rails 27.2 kB, the pre-existing hero/subject blocks 28.1 kB) |
| Artifact | single-file `dist/index.html` **664 617 B** (sha256 `7f0772d325546fa87acd25bd7d7886d8027c10e9e098190e41eba407dd3e1c3e`) / `.gz` **165 957 B** — +4 449 B over D0 |
| Staging | **not done** — there is still no staging host (the same deviation as every entry below). The production shape was rehearsed locally: `ENVIRONMENT=production NODE_ENV=production` on `127.0.0.1:3101`, started without a `.env`, `FRONTEND_DIR` pointing at this build |
| Production | **not done** — follows staging; the production-configured instance served this exact build for every check in the row above |
| Rollback | previous release `64e8012` (D0); not rehearsed (nothing deployed). Frontend-only and additive: reverting the commit restores the previous bundle |
| Deviations | (1) **no staging host**, so this release cannot be marked “done” under the environment rule; (2) no Popular/Trending rail (no real signal exists — B4 was never requested) and no series rail (needs B1 or the labelled B1-alt interim, which is owner decision Q2); (3) scholar tiles deliberately show no counts: one request per scholar would be needed, and the honest server-side counter is B2; (4) two **pre-existing** duplicate requests on the landing were left untouched on purpose (`/api/scholars` twice: hero counter + scholar rail; and the subject-pill block's `limit=100` content call) — consolidating them belongs to D3/D4, and the plan says to keep `Hero` as it is |

### 2026-09-26 — D0 discovery foundation (shared cards, rail, content query) — `7dc5068` — **verified in development, not yet deployed**

|||
| --- | --- |
| What moved | frontend only, **no visible change**: `src/components/cards.tsx` (the cards the four pages each had, extracted verbatim), `src/components/Rail.tsx` (`Rail` + `SectionHeading`), `src/lib/contentQuery.ts` + `src/lib/useContentQuery.ts` (one filter definition and one hook: `pagination.total`, abort on change/unmount, hide on error or empty), an optional `AbortSignal` on `listPublishedContents`, one additive `rail-scroll` utility, and the switch-over of `Lectures`, `Books`, `SubjectDetail` and `Scholars` (−432 / +59 lines of duplicated card code). Analysis, decisions and evidence: `docs/CONTEXT.md` §7q |
| Development | `npx tsc --noEmit` clean (root + `server/`) · `npm run build` ok · render harness against `HEAD`: **16/16 cards and skeletons byte-identical**, 15/15 query cases, 8/8 rail contracts (an empty rail renders nothing, the scroller is a named focusable region, exactly `skeletonCount` placeholders, no Spotify string or colour) · live check on the production-configured instance: **17/17** (`/lectures`, `/lectures?type=audio`, `/lectures?type=video`, `/books`: cards == API records, header counter == `pagination.total`, failing request shows the error state) · counter above the page limit: with 146 published lectures the header read **146** = `pagination.total` while one page of 100 cards rendered (temporary rows deleted afterwards; database back at 16 contents) · `test:e2e:production` **105 pass / 3 fail** — the same two media fixture gaps and the pre-existing `TypeError … 'slug'` as before D0 · `test:e2e:brand` **222/222** |
| Artifact | single-file `dist/index.html` **659 532 B** (sha256 `1ea6bfb0ae3bb4872684a4708efb4d2962c6417f668f01e4aa157d5610a4b575`) / `.gz` **164 272 B** — +1 265 B for the hook and the shared module · tree-shaking check in the bundle: 0 hits for `Show all`, so the rail is **not** shipped yet |
| Staging | **not done** — there is still no staging host (the same deviation as every entry below). The production shape was rehearsed locally: `ENVIRONMENT=production NODE_ENV=production` on `127.0.0.1:3101`, started without a `.env`, `FRONTEND_DIR` pointing at this build; `/api/health` reported `"environment":"production"` |
| Production | **not done** — follows staging; the production-configured instance served this exact build and reported `production (source: process) · release 1.0.0 (037756c)` |
| GitHub | **pushed** as a fast-forward, `037756c..ce4ef58` → `master`. Verified against GitHub afterwards: `master` == local `HEAD` == `ce4ef58`, and the blob id of all twelve touched files (both new modules, the four pages, `api.ts`, `index.css` and the two docs) is identical on both sides. This entry was written while the push was still blocked by a missing credential; the push was carried out in the same session once one was supplied |
| Rollback | previous release `037756c`; not rehearsed (nothing deployed). The change is frontend-only and additive, so reverting the commit restores the previous bundle byte-for-byte |
| Deviations | (1) **no staging host**, so this release cannot be marked "done" under the environment rule; (2) D0 deliberately does not fix the audit's misleading "N found" line next to the filters, nor add "Load more" — both belong to D2, so the discovery plan's honest-scale item is only half done (the header counter) |

### 2026-09-26 — Environment rule (three environments, build-once promotion) — `d833e65` — **verified in development, not yet deployed**

| | |
| --- | --- |
| What moved | development → staging → production: the environment identity and boot guards (`server/src/lib/env.ts`), the staging crawl posture (`routes/seo.ts`, `x-robots-tag` in `server.ts`), `environment`/`environmentSource` in `/api/health`, `deploy-check.sh` check 12 + environment-aware checks 5/6, `healthcheck.sh` environment reporting, the environment banner in every suite, `server/test/environment.test.ts`, and the documents `ENVIRONMENTS.md` / `RELEASES.md` / `DEPLOYMENT.md` / `CONTEXT.md` + `AGENTS.md` §0 step 3 |
| Development | `npx tsc --noEmit` (root + server) clean · `npm run test:all` **exit 0**: audit, uploads 30/30, production 163/163, env-hardening 13/13, **environment 38/38**, ops 21/21, youtube 14+ cases, auth 69/69 · build `dist/index.html` 658 267 B (sha256 `58f62a5bac64fc0a…`), `dist/index.html.gz` 163 628 B |
| Artifact | the single-file build above; served identically by the staging- and production-configured instances used for the checks below |
| Staging | **rehearsed locally, not deployed**: `ENVIRONMENT=staging NODE_ENV=production` on `127.0.0.1:3100` from a directory without a `.env` → boot log `Environment: staging · NODE_ENV=production (process)`, `robots.txt` = `Disallow: /` only, sitemap empty, `x-robots-tag: noindex, nofollow`; `ops/deploy-check.sh --expect-environment staging` → **13 passed, 0 failed**; the same instance with `--expect-environment production` → exit **1** (fails closed). Browser production suite against a production-configured instance: banner `production (source: process)`, **105 green / 3 red** (no imported YouTube/Archive media in this database) |
| Production | **not done** — follows staging; a production-configured instance on `127.0.0.1:3101` gave `ops/deploy-check.sh --expect-environment production` → **11 passed, 0 failed** (normal robots.txt, sitemap with 28 `<loc>`, no `x-robots-tag`) |
| Rollback | previous release `a8f1a88`; not rehearsed (nothing deployed) |
| Deviations | (1) **No staging host exists**, so the release has not been promoted and the rule's "validated in staging" step is still open; the staging shape was rehearsed on localhost with the real production configuration shape instead. (2) The push of `a8f1a88` and of this release is blocked (no push credentials) and GitHub `master` has moved to `6d67ad5`, so it is no longer a fast-forward. Nothing was forced or rewritten. |

### 2026-09-26 — Fase 6.1 SVG logos + public library UX/UI audit (local commits)

| | |
| --- | --- |
| Changes | `5d7c26f` (Fase 6.1: eight transparent path-only SVG logos, BrandLogo integration, 222/222 brand checks) and `a8f1a88` (471-line read-only public library audit) |
| Development | Fase 6.1 was verified locally at the time (build + both typechecks + 222 scoped brand checks); the audit was read-only and ran no suites |
| Artifact | `5d7c26f` was built and measured then (`dist/index.html` 658 219 B, `.gz` 163 620 B) |
| Staging | **not done** — no staging environment existed |
| Production | **not done** — GitHub push of `a8f1a88` is still blocked by missing push credentials, and GitHub `master` has moved on (`6d67ad5`), so the push is no longer a fast-forward |
| Deviations | Both commits exist locally only; until they are pushed and pass staging, they are not releasable under the environment rule. Historical note kept here so the gap is not forgotten. |
