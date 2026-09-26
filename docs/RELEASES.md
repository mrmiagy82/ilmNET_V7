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
