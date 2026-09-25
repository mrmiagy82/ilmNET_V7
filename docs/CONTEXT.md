# ilmNet — CONTEXT

Living document for AI/OpenCode sessions. **Read this before touching code** (see `AGENTS.md`).
Update it after every finished phase, commit, sanity check or significant discovery.
Rules: only facts that are verifiable from the repository, Git history or existing docs — and
**never** secrets, tokens or credentials.

_Last updated: Fase 4.5 (real admin authentication)._

Fase 4.4 (a read-only audit of the admin authentication) was answered with the Fase 4.5 instruction;
since then every `/admin` route signs in with a username and a password.

---

## 1. Current status

| | |
| --- | --- |
| Branch | `master` |
| Codebase state described here | `dab8211` (Fase 4.3 YouTube) **plus** the Fase 4.5 authentication changes in §7f — this document ships in the Fase 4.5 commit |
| This document | updated in Fase 4.5; its own revision is visible with `git log -1 -- docs/CONTEXT.md` |
| Working tree | clean (verified against `origin/master`) |
| Repository | `github.com/mrmiagy82/ilmNET_V7` |
| Size | 66 source files, ~14.9k lines in `src/` + `server/src/`; the admin (`src/admin/`, 20 files, ~6.6k lines) is the largest area |
| Build (git-ignored artefact) | single-file `dist/index.html` (644.42 kB, 161.00 kB gzip) |
| Phase state | Fase 4.5 complete: operators sign in with a username + password (scrypt, server-side sessions, HttpOnly cookie); the legacy `ADMIN_TOKEN` still works as a dual-mode fallback; writes carry `createdBy`/`updatedBy` |
| Open blockers | none. Note: YouTube throttles watch-page *scrapes* from this datacenter IP (`302 → google.com/sorry`) now and then, which can fail the live `test/youtube.test.ts` and `test:imports` checks; embeds, playback and `oEmbed` keep working (see §8.11) |

## 2. Completed phases (from Git history)

| Commit | Phase | Content |
| --- | --- | --- |
| `3123382` | Initial commit | static frontend |
| `d668607` | Fase 3 | admin CMS on a real database + real-content tests |
| `30d1a7e` | Fase 3.5 | library UX + content structure (series/collections) |
| `d052659` | Fase 3.6 | audio player (live waveform) + thumbnail policy |
| `9e09937`, `e257e1e` | Fase 3.7 | production readiness (env, health, runbook) |
| `96513a1` | Fase 3.8 | deployment prepared and tested end-to-end |
| `944a83f` | Fase 3.8.1 | production env/security hardening (`.env` may not configure a prod boot) |
| `cfe8587` | Fase 3.9 | final production codebase review + sanity-check fixes |
| `f4aad03` | Fase 3.9.1 | honesty of counters, status and copy |
| `2f16540` | Fase 3.10 | project context + agent continuity (`AGENTS.md`, this file) |
| `45fc54a` | Fase 4 | admin CMS: archived status, real totals, honest admin states (see §7) |
| `5805520` | Fase 4.1 | admin authentication: real login gate on the existing `ADMIN_TOKEN` (see §7c) |
| `07ea4a9` | Fase 4.2 | admin CMS cleanup: no CMS naming, no unused admin helpers — functionality unchanged (see §7d) |
| `dab8211` | Fase 4.3 | YouTube: optional official Data API for the import, verified public playback (see §7e) |
| _this commit_ | Fase 4.5 | real admin authentication: username + password, server-side sessions, attribution (see §7f) |

Earlier work is documented per topic in `docs/FASE2A_ARCHIVE.md`, `docs/FASE2B_YOUTUBE.md`,
`docs/FASE2C_PUBLIC_FRONTEND.md`, `docs/FASE2D_SEARCH_FILTERING.md`,
`docs/AUDIT_FASE2A_HARDENING.md`, `docs/BACKEND_VERIFICATIE.md`.

## 3. Architecture and key decisions

**Shape.** One PostgreSQL database, one Fastify API, one React SPA. The API serves the built
frontend in the default deployment (`SERVE_FRONTEND`, `FRONTEND_DIR`), so public pages, embeds and
the CMS share one origin and `/api` needs no cross-origin setup.

**Data model** (`server/prisma/schema.prisma`): `Content` (one generic table with `ContentType`
enum `lecture|audio|video|book|document` and `Provider` enum `youtube|archive|google_books|pdf|
external`) plus `Scholar`, `Subject` (with `SubjectGroup`), the join tables `ContentScholar` /
`ContentSubject`, and `ImportJob` for bulk imports. A single generic table replaced the earlier
split lecture/book models — the admin adapts to it in `src/lib/api.ts`
(`backendToAdminLecture` / `backendToAdminBook`).

**Why it matters:** `provider + externalIdentifier` is unique, so re-importing the same item is a
duplicate instead of a second record; `collectionIdentifier` is what groups items into a series or
playlist.

**Frontend** (`src/`): `pages/` public routes, `components/` shared UI, `admin/` the CMS
(store + forms + import pages), `src/lib/api.ts` is the only HTTP client, next to `src/lib/series.ts`
(collection grouping, download/stream URL resolution) and `src/lib/thumbnail.ts` (three-layer
thumbnail policy: custom upload → provider image → ilmNet placeholder).

**Public routes:** `/`, `/lectures`, `/lectures/:id`, `/books`, `/books/:id`, `/series/:id`,
`/scholars`, `/subjects`, `/subjects/:id`, `*` → landing. Detail routes accept an id **or** a slug
(`getPublishedContent(idOrSlug)`); links in the UI use slugs, series use `collectionIdentifier`.
**Admin routes** (all under `/admin`): index, `new`, `archive-import`, `youtube-import`, and
`lectures|books|scholars|subjects` with `new` / `:id`. The admin store is mounted on the `/admin` routes only, so
public pages never call admin endpoints.

**API:** public reads `/api/contents`, `/api/v1/contents` (both force `status = published`),
`/api/contents/:id|slug`, `/api/scholars`, `/api/subjects` (+ by id/slug), `/api/health`,
`/api/v1/health`. Admin: `/api/admin/…` for contents, scholars, subjects, uploads and
`/api/admin/imports/{archive,youtube}/{preview,confirm}`. Writes go through zod validation.

**Content embeds.** `buildEmbedUrl` in `server/src/routes/content.ts` derives the embed from the
source URL (YouTube video/playlist, Archive.org item, Google Books front cover); the frontend never
re-hosts media. Downloads are offered only when a real file URL can be constructed
(`src/lib/series.ts`), otherwise the UI links to the source page.

**YouTube.** Import and playback are fully server-side and keyless by default: the importer reads the
public watch/playlist pages, the public pages embed `https://www.youtube.com/embed/<videoId>` in an
iframe (no CSP or framing headers block it). With `YOUTUBE_API_KEY` in the server's process
environment the importer prefers the official Data API v3 and can report `status.embeddable`; without
a key — or when the API rejects it — it falls back to the public pages and says so in the preview.
The key is server-side only: never `VITE_*`, never in the database, the bundle or a document.

**Single-file build.** `vite-plugin-singlefile` inlines everything into one `index.html`. Consequence:
**code splitting / lazy admin routes are pointless** — this was measured (Fase 3.9: 637 kB → 643 kB,
i.e. no gain). Do not retry it unless the build target itself changes.

**Admin reads/writes.** The admin store (`src/admin/store.tsx`) is the only place that touches
`/api/admin/*`; it maps backend rows to `AdminLecture`/`AdminBook` through `src/lib/api.ts`. Statuses
round-trip unchanged (`draft | published | archived`) and group fields (`series`,
`collectionIdentifier`, `collectionTitle`) survive an edit. Counters come from `pagination.total`
(one record per query) — never from the capped list and never invented.

**Admin authentication (Fase 4.5).** Operators have real accounts. `AdminUser` (username, scrypt
password hash, role, disabled, lastLoginAt) and `AdminSession` (SHA-256 hash of a 32-byte token,
expiry, lastSeenAt, user agent, IP) live in PostgreSQL. `POST /api/admin/login` verifies the password
with `node:crypto` scrypt (constant time, with a dummy hash for unknown users so timing cannot
enumerate accounts) and issues an `HttpOnly; Secure; SameSite=Lax; Path=/` cookie; the raw token
exists only in that cookie. `POST /api/admin/logout` destroys the session server-side and clears the
cookie; `GET /api/admin/session` tells the gate who is calling (`session`, or `token` in the legacy
fallback — with `user: null`, never an invented identity). The request hook in `server.ts` protects
every `/api/admin/*` path and every write under `/api/*`: session cookie first, then the legacy
`ADMIN_TOKEN` header/bearer (dual mode, for scripts and CI), then the non-production localhost
convenience; `/api/admin/login` and `/api/admin/logout` are the only admin paths reachable without
credentials. Sessions are rolling (12 h default, `ADMIN_SESSION_TTL_MINUTES`, hard cap 30 days) and
are revoked when a password changes or an account is disabled. Login attempts are throttled
in-process (5 failures per username+IP, 20 per address, 15-minute window). Accounts are managed from
the server with `npm run admin:create|password|disable|enable|list`. The browser stores **no**
credential: not in `localStorage`, not in `sessionStorage`, not in the bundle — `/admin` is wrapped in
`AdminAuthProvider` → `AdminGate` → `AdminProvider`, the gate asks `GET /api/admin/session` before it
mounts anything, and a refresh re-verifies. Writes are attributed: `Content.createdBy`/`updatedBy`
and `ImportJob.createdBy` carry the signed-in username (`null` when the caller was the legacy token or
the localhost bypass — attribution never invents a name). The public site needs no login at all.

**Style.** Neumorphic/spatial UI with the cream/olive/rose palette; no religious symbols or
decorative clichés; the public site is free and needs no login. Fixed website texts (headings, labels,
empty states, errors) live in the React components — there is no content layer or CMS for UI strings.

## 4. Production / deployment status

- The deployment runbook is `docs/DEPLOYMENT.md`: environment variables, systemd/pm2 and Docker
  Compose setups, the production-safe seed, health checks and rollback.
- `GET /api/health` reports service + database + upload storage and returns **503** when the
  database is unreachable or the upload volume is not writable — use it to verify a deployment.
- Configuration comes from the process environment only. A `.env` file supplying `NODE_ENV`,
  `ADMIN_TOKEN`, `CORS_ORIGIN` or `ADMIN_ALLOW_LOCALHOST` makes a production boot **refuse to start**
  (Fase 3.8.1). Reference: `docs/FASE3_8_1_ENV_SECURITY.md`.
- Uploads must live on a persistent volume (`UPLOADS_DIR`, e.g. `/var/lib/ilmnet/uploads`),
  otherwise images vanish on redeploy while the database keeps referencing them.
- Production reference data: `npm run seed:reference` (subjects + scholars only, never content).
  The destructive demo seed refuses to run in production.
  - `server/.env` in this repository is **development only** and stays untracked; the production token
    is entered by the operator on the `/admin` login screen (Fase 4.1). It is verified against the API
    and survives only in that tab's `sessionStorage` — never in the repo, the bundle or `localStorage`.
- Note for sandboxes: this workspace is ephemeral — dependencies, PostgreSQL and running processes
  are **not** part of the snapshot. Rebuild them (see `README.md` § Local development) before
  running tests, and check `git status` afterwards for stray artefacts.

## 5. Security rules (non-negotiable)

1. No secrets in the repository, in documents, in commits or in `docs/CONTEXT.md`. `.env`,
   `server/.env`, `dist/`, `server/dist/`, `node_modules/`, logs and the opencode tarball are
   git-ignored.
2. Never put a credential in the frontend. The browser authenticates with a username + password
   and stores nothing (the session lives in an `HttpOnly` cookie); `VITE_*` values would be inlined
   into the public bundle, so no token or password may ever come from there. `VITE_ADMIN_TOKEN` is
   obsolete since Fase 4.5 — the API ignores browser tokens entirely.
3. Every `/api/admin/*` request and every write requires either a valid session cookie or (dual
   mode) the `ADMIN_TOKEN`, which must be at least 16 characters and non-guessable; anything else is
   401. Passwords are scrypt-hashed (≥10 characters, no known defaults, never equal to the username);
   only the SHA-256 hash of a session token is stored. `CORS_ORIGIN` lists exact origins — a wildcard
   stops a production boot.
4. Public endpoints expose published content only; drafts stay invisible (verified in Fase 3.9,
   including detail pages and search).
5. A rejected token must be reported as an authentication problem (401), not as “backend
   unreachable” (implemented as `backendState` in `src/admin/store.tsx`).
6. The API redacts `x-admin-token` / `authorization` headers from its logs
   (`server/src/server.ts`).
7. `/admin` mounts no CMS code before the API has verified the session (Fase 4.1/4.5); a refresh
   re-verifies, a tampered, expired, revoked or disabled-account session falls back to the login
   screen and the dead cookie is cleared, and no credential ever appears in the URL, `localStorage`
   or `sessionStorage`.
8. `YOUTUBE_API_KEY`, when used, lives in the **server** process environment only. It is never sent to
   the browser, stored in the database, committed, documented with a value, or repeated in an error
   message (Fase 4.3 redacts it; the importer keeps working without it).

## 6. Testing

| Command | What it covers | Last verified result |
| --- | --- | --- |
| `npx tsc --noEmit` (root + `server/`) | types | 0 errors |
| `npm run build` (root) | single-file production build | ~642 kB / ~160.5 kB gzip |
| `cd server && npm run test:all` | audit, uploads (25), production readiness (44), env hardening (13), youtube (+ Data API fallback), **auth (69)** | all green in Fase 4.5 (the live YouTube scrape check can fail when Google throttles this IP — see §8.11) |
| `cd server && npm run test:imports` | live Archive.org + YouTube import regression | 19/19 |
| `npm run test:e2e:production` | routes, embeds, **real YouTube playback**, error states, mobile, admin entry (login gate) | 67/67 |
| `npm run test:e2e` | waveform, thumbnails, admin upload flow | 27/27 |
| `npm run test:e2e:cms` | admin CMS: real totals, draft→published→archived→restored, collection round-trip, 401 honesty | 28/28 |
| `npm run test:e2e:auth` | Fase 4.5 gate: username/password sign-in, 401s, cookie flags, deep link, refresh, tampered cookie, server-side logout, no credential in web storage, public site stays free | 60/60 |

Browser specs take `SITE_URL`, `API_URL`, `ADMIN_TOKEN` (for their API fixtures) and sign the
browser in with `ADMIN_USERNAME`/`ADMIN_PASSWORD` (usernames default to `e2e-admin` for the
production suites and `media-e2e-admin` for the media suite; the **password has no default** — no
credential is committed — so create the account with `npm run admin:create` and export
`ADMIN_PASSWORD`); the server suite
takes `TEST_ADMIN_TOKEN`. `tests/e2e/lib/admin-session.mjs` holds the shared sign-in helper (it logs
in over the API and hands the session cookie to the browser context — nothing is injected into
JavaScript-visible storage). The server suite needs an explicit mode next to a deployment variable
(`NODE_ENV=test ADMIN_TOKEN=… npm run test:all`) — a boot that sees `ADMIN_TOKEN` without `NODE_ENV`
refuses to start (Fase 3.8.1). `test:e2e:auth` and `test:e2e:production` expect a production server
(`NODE_ENV=production`, the same `ADMIN_TOKEN`, matching `CORS_ORIGIN`). Mutating suites clean up their
own records — verify afterwards, and never point them at a database whose content must be preserved.
Known quirk: `test:imports` deliberately leaves the imported record in place (that is part of what it
asserts), so run it against a throwaway database or remove the record afterwards.

## 7. What Fase 4 (the admin CMS) changed (so it is not re-broken)

The admin CMS already existed (Fase 3). Fase 4 closed the gaps between it and the database, without
touching the schema or adding dependencies:

- **`archived` is a first-class status in the admin.** `StatusPill`, the status filter
  (`All states / Published / Draft / Archived`), the row actions and the edit forms all know it.
  Archive keeps the record in PostgreSQL (public API returns 404 for it); *Restore to draft* brings
  it back as a draft — archived content never returns to the public site on its own.
- **Editing no longer destroys data.** `adminLectureToPayload` used to send
  `collectionIdentifier: null; collectionTitle: null` and `adminBookToPayload` sent `series: null`,
  so one save wiped a bulk-import grouping. Both now round-trip `series` + `collectionIdentifier` +
  `collectionTitle` (and `thumbnailUrl` for books), and the forms show the collection a record
  belongs to.
- **No status is silently rewritten.** `backendToPublishStatus()` is now the single mapping; before,
  every non-published record (including archived) was turned into `draft` on load.
- **Dashboard totals are real.** `pagination.total` (seven `limit=1` queries) instead of counting a
  list capped at 100 items; while loading or when the token/API fails, the dashboard shows a state —
  never a `0` that looks like an empty library.
- **Lists and forms have loading/error states.** Lists show placeholders while loading and an
  explicit 401/offline row instead of an empty table; a direct URL or hard refresh on an edit page
  shows *Loading…* and then the hydrated form (the form mounts per record, so it can never be empty).
- **Honest counting.** `CountLine` prints “N shown · M in the database” when the database holds more
  than the loaded page.
- **Tests.** `tests/e2e/cms.spec.mjs` (`npm run test:e2e:cms`) drives the real admin in a browser:
  it archives, restores, publishes, edits a bulk-import-shaped record and checks the 401 path.

## 7b. What Fase 3.9 / 3.9.1 changed (still valid)

- Landing page shows **real** library counts (`pagination.total` per type + scholar count) and
  nothing while loading; the subject pills/cards are real subjects with real item counts.
- No invented metrics anywhere: the fake “1.3k LISTENS”, the hero’s `1,240+ / 380 / 96`, the
  decorative times, progress bars and “Continue where you left off” are all gone. The hero
  illustration now labels itself (“Player preview”, “Book preview”).
- List pages: “Items” counts real items; counters show `—` during loading **and** on error, never
  `0`.
- Admin: the activity feed only logs writes the database confirmed; optimistic list changes are
  reverted on failure; a 401 is reported as a token problem; copy never claims data is not stored.
- All demo/mock code left the codebase: no `mockFetchArchiveCollection`, no demo import branch or
  demo buttons, no seeded activity, no `mockFetch` fallback on errors.
- Docs: `docs/FASE3_9_CODEBASE_REVIEW.md` holds the full review, the 3.9.1 fix list and the
  verification table.

## 7c. What Fase 4.1 (admin authentication) changed (so it is not re-broken)

- **`/admin` is a real, gated admin environment.** `src/admin/auth.tsx` (`AdminAuthProvider` /
  `useAdminAuth`), `src/admin/AdminLogin.tsx` (the login page) and `src/admin/AdminGate.tsx` (the route
  guard) replaced the old `AdminTokenPanel`. Before this phase the CMS rendered straight away with a
  token banner; now it cannot render at all until the API has confirmed the token.
- **The credential stays server-side.** No new secret store, no schema change, no dependency, no mock
  auth: the only credential is the existing `ADMIN_TOKEN`, the browser carries it in `sessionStorage`
  and sends it as `x-admin-token`. Sign-in is `setAdminToken()` followed by a real verification call.
- **Verification, not trust.** `verifyAdminSession()` in `src/lib/api.ts` never throws and returns
  `{ok, status}`; the gate states are `checking | signed-in | signed-out`. A `runId` ref protects
  against races, so a slow older verification can never override a newer sign-in or a sign-out.
- **Honest failure copy.** A rejected token: “That admin token was rejected by the API (401). Check the
  ADMIN_TOKEN configured on the server.” An unreachable backend changes nothing and says so. Any
  401/403 during normal use ends the session with “This session was no longer accepted by the API (401).
  Sign in again.” (`AdminLayout` reacts to `backendState === 'unauthenticated'`.)
- **Refresh and deep links are safe.** A reload re-verifies against the API, so a tampered or expired
  session lands back on the login screen. The current URL is preserved across the login, so
  `/admin/lectures/:id` opens that page after signing in. Sign-out (`admin-signout`) clears the token.
- **The public side is untouched.** No public route, API or layout changed; the public library needs no
  login (asserted by the suite). The auth test ids are `admin-login`, `admin-login-token`,
  `admin-login-submit`, `admin-login-message`, `admin-login-retry`, `admin-gate-checking`, `admin-signout`.

## 7d. What Fase 4.2 (admin CMS cleanup) changed

Nothing functional was reverted: Fase 4 (admin CMS: statuses, real totals, honest states) and Fase 4.1
(login gate on `ADMIN_TOKEN`) are exactly as they were. What changed is naming and dead weight:

- **One name, no CMS product talk.** The admin surface is called *the admin CMS* everywhere — code,
  tests, `AGENTS.md` and these docs. There is no CMS framework, no product/codename, no content layer
  and no configuration file for website strings anywhere in the project (it was checked repo-wide).
- **Fixed website copy lives in the React components.** Headings, labels, empty states and error texts
  are plain JSX. The only content layer is PostgreSQL behind the public API (`/api/contents`,
  `/api/scholars`, `/api/subjects`); no table, file or admin screen manages UI text. The public site
  stays free and needs no login.
- **Unused admin helpers removed** (verified unused — declaration only, no reference in `src/`,
  `tests/` or `server/`): in `src/admin/data.ts` `archiveContentTypeOptions`, `isYoutubeVideoUrl`,
  `detectLectureSource`, `detectProvider`, `youtubeThumbnail`, `inferArchiveItemKind`,
  `inferContentTypeFromKind`, plus the dead duplicate pair `parseYouTubeIdentifier` /
  `getYouTubeEmbedUrl` (the app uses `getYoutubeEmbedUrl`); in `src/admin/ui.tsx` `SourcePreview` and
  `CoverPreview`; in `src/lib/api.ts` `getAdminContent`, `listUploadedImages`, `deleteUploadedImage`.
- **Kept on purpose:** the admin store/forms/import pages, the four e2e suites, the `test:e2e:cms`
  script and `tests/e2e/cms.spec.mjs` (that is the admin-CMS browser suite), and every public route.

Verified after the cleanup (fresh database, real Archive.org/YouTube imports as fixtures — 18 content
records, 8 scholars, 11 subjects): `npx tsc --noEmit` clean in `./` and `./server`; `npm run build` →
642.36 kB / 160.44 kB gzip; `test:all` green (uploads 25/25, readiness 44/44, env 13/13);
`test:imports` 19/19; `test:e2e:cms` 28/28; `test:e2e:auth` 42/42; `test:e2e` 27/27;
`test:e2e:production` 64/64. A repo-wide search for the old product name returns zero hits (outside
the historical phase docs), the public routes render without login and every `/admin` route still
sits behind the Fase 4.1 login.

## 7e. What Fase 4.3 (YouTube playback & import) changed

Investigated first, changed second — the YouTube path was already close to production-ready.

- **How the import worked (and still works):** entirely server-side with no key. A single video comes
  from oEmbed plus `ytInitialPlayerResponse` on the watch page; a playlist from the playlist page
  (`lockupViewModel`) capped at 100 items, 7 s timeout per request. Failures are honest errors — never
  invented items. Verified live: preview + confirm of single videos and playlists.
- **Where the official API belongs:** nowhere is mandatory, but `YOUTUBE_API_KEY` (optional,
  **process environment of the server only**) now makes the importer use the YouTube Data API v3 first:
  `videos.list` (snippet, contentDetails, status) and `playlistItems.list` + batched `videos.list` for
  exact durations. It adds `status.embeddable`, which scraping cannot know — an unembeddable video
  would otherwise become a page whose player cannot play it (reported as a warning in the preview).
  A rejected key, exhausted quota or an unreachable Google falls back to the public pages and says so;
  the key never appears in a payload, warning, log line, the database or the frontend.
- **How ids are stored:** `externalIdentifier` = the 11-character videoId, `sourceUrl` = the watch URL,
  `embedUrl` = `https://www.youtube.com/embed/<videoId>` (server-built in `buildEmbedUrl`), playlist
  items share `collectionIdentifier` = the playlist id with `collectionTitle`. No schema change.
- **How the public player works:** `src/pages/ContentDetail.tsx` renders `embedUrl` in an iframe
  (16:9, `allowFullScreen`, no cookie/consent wall in our code) and keeps an “Open original” link; the
  API sets no framing headers and no CSP, so the frame is never blocked. Collection pages list the
  items, each playing its own embed.
- **Playback proven in production:** against the built production server, the embed boots
  (`#movie_player` + `video`), playback starts and advances (`currentTime` > 0, player state 1) while
  real `googlevideo.com/videoplayback` requests are made. `test:e2e:production` now asserts all three,
  so a broken player fails the suite. Headless Chromium cannot deliver a trusted click into a
  cross-origin frame, so the test starts playback through the player API — the same player a visitor's
  click drives.

## 7f. What Fase 4.5 (real admin authentication) changed

The audit in Fase 4.4 found one shared `ADMIN_TOKEN` and no accounts, sessions, attribution or
throttling. Fase 4.5 replaced exactly that, without touching anything else:

- **Real accounts.** `admin_users` (username unique, scrypt password hash, role, disabled,
  lastLoginAt) and `admin_sessions` (SHA-256 hash of a 32-byte token, userId FK cascade, expiresAt,
  lastSeenAt, userAgent, ip) — one migration, `20260925170628_fase_4_5_admin_auth`, which also added
  `contents.createdBy` / `contents.updatedBy` (both nullable). Existing tables were not changed
  otherwise.
- **Credentials never reach the browser.** `POST /api/admin/login` checks the password with
  `node:crypto` scrypt (N=16384, r=8, p=1, 64-byte key, random salt; constant-time compare; a dummy
  hash burns the same CPU for unknown users) and answers with the generic
  `INVALID_CREDENTIALS` for every failure — unknown user, wrong password and disabled account are
  indistinguishable. The session token (32 random bytes, hex) travels only in the cookie; the
  database stores its SHA-256 hash, and `logout` deletes the row, so a captured cookie dies with the
  session.
- **Cookie.** `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=…` — JavaScript cannot read it, it is
  never sent cross-site, and CSRF does not need a second token. Sessions roll (default 12 h,
  `ADMIN_SESSION_TTL_MINUTES`, hard cap 30 days) with `lastSeenAt` written at most every 5 minutes;
  expired rows are removed on use and at login.
- **Protection order (`server.ts`).** session cookie → legacy `ADMIN_TOKEN` (dual mode, no identity)
  → localhost convenience (non-production only) → 401. `/api/admin/login` and `/api/admin/logout`
  are the only admin paths that need no credentials. A rejected cookie is cleared in the response.
- **Throttling.** In-process: 5 failures per username+IP and 20 per address inside a 15-minute
  window → `429` with `Retry-After`. A blocked username does not block other operators.
- **Attribution.** `Content.createdBy`/`updatedBy` (create, patch, archive, publish, unpublish,
  bulk) and `ImportJob.createdBy` (previews, failures, imports) carry the signed-in username; token
  and localhost callers leave `null` — the system never invents an operator.
- **Frontend.** `src/lib/api.ts` keeps only `adminLogin`/`adminLogout`/`fetchAdminSession` (all with
  `credentials: "include"`); `src/admin/auth.tsx` exposes `status`, `user`, `method`, `message`,
  `busy`, `signIn(username, password)`, `signOut`, `retry`; `AdminLogin.tsx` has username + password
  fields (`admin-login-username` / `admin-login-password`; the old `admin-login-token` is gone) and
  `AdminLayout` shows “Signed in as …”. Nothing is written to `localStorage`/`sessionStorage`.
- **Accounts are managed from the server:** `npm run admin:create|password|disable|enable|list`
  (`--password` or `ADMIN_PASSWORD`; changing or disabling revokes every session of that account).
- **Tests.** New `server/test/auth.test.ts` (69 checks: hashing, policy, cookie flags, hash-only
  storage, expiry, disabled account, forgery, throttling, dual mode, attribution) and a rewritten
  `tests/e2e/admin-auth.spec.mjs` (60 checks). `cms`, `media` and `production` suites now sign in
  through `tests/e2e/lib/admin-session.mjs`, which logs in over the API and injects the resulting
  cookie — the same thing an operator gets, with nothing in web storage.
- **Verified in this phase:** `tsc --noEmit` clean in `./` and `./server`; `npm run build` →
  644.42 kB / 161.00 kB gzip; `test:all` green (uploads 25/25, readiness 44/44, env 13/13, auth
  69/69; the live YouTube scrape check was green earlier in the session and later hit Google's
  datacenter throttle — see §8.11); `test:e2e:auth` 60/60, `test:e2e:cms` 28/28,
  `test:e2e:production` 67/67 (including real YouTube playback), `test:e2e` 27/27; both databases
  hold 18 published records (8 books, 7 videos, 3 audio) imported from Archive.org and YouTube.

## 8. Known remaining issues (not blockers)

From `docs/FASE3_9_CODEBASE_REVIEW.md` § Restrisico's plus the 3.9.1 report:

1. **Single-file bundle** — the CMS ships inside the same `index.html` as the public site; code
   splitting is impossible while `vite-plugin-singlefile` is active.
2. **100-item lists** — public lists and the admin store fetch up to 100 items per request; growth
   needs server-side pagination / infinite scroll (`pagination.total` already exists, and the admin
   now reports the real total next to the loaded page).
3. **Search** is `ILIKE %q%` across several columns; thousands of records need a trigram/full-text
   index.
4. **No rate limiting** on the public API (a reverse-proxy concern).
5. **Import endpoints** call external providers without throttling beyond their own limits.
6. **External availability** — audio and book files live on archive.org; the player and downloads
   point straight at the source.
7. **Tailwind scans the whole project**, including `server/` and `docs/`. A word such as `visible`
   in `server/src/lib/storage.ts` adds one unused CSS rule to the bundle. Cosmetic; fixable with an
   `@source` scope in `src/index.css`.
8. **`npm run test:imports` leaves one record** in the target database by design (see §6).
9. **Admin accounts exist, but management is CLI-only** (Fase 4.5): no password-reset or
   account-management UI, no 2FA, and `AdminUser.role` is stored yet every admin currently has the
   same rights. The login throttle is in-process (single node) — a multi-instance deployment needs a
   shared store. There is still no separate audit-log table: attribution lives on the records
   (`createdBy`/`updatedBy`, `ImportJob.createdBy`).
10. **Dead helpers outside the admin surface** were left alone in Fase 4.2 (they are unreferenced but
    pre-date the CMS work): `src/lib/thumbnail.ts` `isUsableThumbnail` / `getEffectiveThumbnail`,
    `src/lib/api.ts` `getPublicScholar`, `src/components/ui.tsx` `SectionLabel`. Safe to delete in a
    later cleanup; removing them changes nothing at runtime.
11. **YouTube throttles watch-page scrapes from datacenter IPs.** Google may answer the watch page
    with `302 → google.com/sorry` (observed in the Fase 4.5 session after many live requests), which
    fails the live checks in `server/test/youtube.test.ts` and `test:imports`. Embeds, playback and
    `oEmbed` were unaffected. Setting `YOUTUBE_API_KEY` (Fase 4.3) or retrying later removes the
    dependency on scraped pages — the same checks passed earlier in the same session.
12. **The admin session cookie is `Secure`, so the CMS needs HTTPS** (or `localhost`/`127.0.0.1`,
    which browsers treat as trustworthy). A production deployment on plain `http://<host>` will log
    in and then appear signed out, because the browser refuses to store the cookie. Terminate TLS at
    the reverse proxy.
13. **`VITE_ADMIN_TOKEN` is obsolete** (Fase 4.5): the frontend no longer reads it. Existing local
    `.env` files that still set it are harmless but should be cleaned up; `AGENTS.md` keeps the rule
    that no credential may come from `VITE_*`.

## 9. Next step

No open blockers: Fase 4.5 replaced the shared token with real accounts, sessions and attribution
(§7f), Fase 4.3 verified YouTube import and playback (§7e), Fase 4.2 removed the leftover naming and
dead helpers (§7d), Fase 4.1 put the CMS behind a login (§7c), and every suite is green — except the
live YouTube scrape check when Google throttles this IP (§8.11), which is external and passes again
after a pause. The next step is a **new user instruction**; the documented candidates are the items
in §8, e.g. account management in the UI, roles/permissions, 2FA, a shared throttle store for
multi-instance deployments or an audit-log table. Before starting: `git status`,
`git log --oneline -3`, and re-read this file.

## 10. How to keep this file accurate

- After every commit that changes state: update §1 (commit, status) and, if relevant, §7/§8.
- After a sanity check: record the verification outcome with numbers, and add anything the check
  discovered to §8.
- After a phase: add a row to §2 and refresh §9.
- Keep it free of secrets, of live/deployment-specific values, and of claims you cannot point to in
  code, Git history or the docs under `docs/`.
