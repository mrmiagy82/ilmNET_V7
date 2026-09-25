# ilmNet — CONTEXT

Living document for AI/OpenCode sessions. **Read this before touching code** (see `AGENTS.md`).
Update it after every finished phase, commit, sanity check or significant discovery.
Rules: only facts that are verifiable from the repository, Git history or existing docs — and
**never** secrets, tokens or credentials.

_Last updated: Fase 5.3 (data & security hardening: legacy token off by default, public payloads
whitelisted, destructive deletes confirmed, uploads checked by magic bytes)._

The last phases: Fase 5.1 closed the three blockers from the Fase 5 audit (backup + restore, honest
footer links, TLS/HSTS with a provider-agnostic runbook, §7g). Fase 5.2 hardened the deployment
itself: forwarded headers are only trusted when `TRUST_PROXY` names a proxy, the HTTP→HTTPS redirect
can no longer be steered by a forged host, a `FORCE_HTTPS` misconfiguration is refused at boot,
Postgres is no longer published by the compose file (which was not even valid YAML before), and the
API gained a cheap readiness probe (§7h). Fase 5.3 then closed the data-safety items of the audit
(I6/I7/I8/L4): the legacy shared token is off in production by default, public responses are built
from a positive list (no `createdBy`/`updatedBy`/`importJobId`, and no draft content on a scholar
page), an irreversible delete must name its record in the API and in the CMS, and uploads are
recognised by their magic bytes instead of the client's `Content-Type` (§7i).

---

## 1. Current status

| | |
| --- | --- |
| Branch | `master` |
| Codebase state described here | `504e353` (Fase 5.2) **plus** the Fase 5.3 changes in §7i — this document ships in the Fase 5.3 commit |
| This document | updated in Fase 5.3; its own revision is visible with `git log -1 -- docs/CONTEXT.md` |
| Working tree | clean (verified against `origin/master`) |
| Repository | `github.com/mrmiagy82/ilmNET_V7` |
| Size | 69 source files, ~15.6k lines in `src/` + `server/src/`; the admin (`src/admin/`, 20 files, ~6.5k lines) is the largest area |
| Build (git-ignored artefact) | single-file `dist/index.html` (644.42 kB, 161.00 kB gzip, measured in Fase 4.5) |
| Phase state | Fase 5.3 complete: the audit's data-safety items are closed — production runs on accounts (the legacy `ADMIN_TOKEN` needs an explicit `ADMIN_LEGACY_TOKEN=true` and a production boot without accounts refuses to start), public endpoints answer with a positive list instead of the raw row, hard deletes and scholar/subject deletes require `?confirm=<id|slug>` (typed in the CMS), uploads are validated by magic bytes, and `/api/health` no longer publishes the upload path (§7i) |
| Roadmap | production finishing, UI/UX and performance toward the definitive live deployment (§9). The audit's Fase 5.4 (scale/speed) and 5.5 (polish/compliance) work is next; the remaining deploy work is host-side (§8.14) |
| Open blockers | none in the repository. Host-side and not verifiable from the repo: terminating TLS, forwarding `X-Forwarded-Proto`, choosing `TRUST_PROXY` for the real topology, the nightly backup timer plus off-site copies, uptime/alerting, and public-API rate limiting (§8.14). Data-safety wise nothing is open: the last low-priority item is the `__Host-` cookie prefix (§8.15) |

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
| `45fc54a` | Fase 4 | admin CMS: archived status, real totals, honest admin states (see §7). Committed under the working name “TinyCMS”, which is scrapped since Fase 4.2 — do not reintroduce it (§7d) |
| `5805520` | Fase 4.1 | admin authentication: real login gate on the existing `ADMIN_TOKEN` (see §7c — the gate stands, its token credential model was replaced in Fase 4.5, §7f, and that token is now off in production by default, §7i) |
| `07ea4a9` | Fase 4.2 | admin CMS cleanup: no CMS naming, no unused admin helpers — functionality unchanged (see §7d) |
| `dab8211` | Fase 4.3 | YouTube: optional official Data API for the import, verified public playback (see §7e) |
| — (diagnosis only) | Fase 4.3.1 | YouTube “Error 153”: proven that the missing `Referer` is not lost in our code; no change, no commit (see §7e) |
| — (audit only) | Fase 4.4 | read-only audit of the admin authentication; no change, no commit — answered by the Fase 4.5 instruction (see §7f) |
| `720ef70` | Fase 4.5 | real admin authentication: `AdminUser` + `AdminSession`, username + password, secure session cookie, attribution (see §7f) |
| `f030ef3` | Fase 4.5.1 | project context synchronized with the post-4.5 repository: roadmap, scrapped TinyCMS, test status and remaining issues |
| — (audit only) | Fase 5 | production readiness audit; read-only, no commit — three blockers: no backup/restore, TLS not proven, footer linked to a single page |
| `a7d6865` | Fase 5.1 | production blockers closed: `ops/` backup + restore + drill, honest footer navigation, TLS/HSTS support (see §7g) |
| `504e353` | Fase 5.2 | deployment hardening: proxy trust (`TRUST_PROXY`), safe forwarded-host handling, boot guards, no public Postgres/API port, readiness probe (see §7h) |
| _this commit_ | Fase 5.3 | data & security hardening: legacy token off in production, whitelisted public payloads, confirmed destructive deletes, byte-verified uploads, no path leak in health (see §7i) |

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
`ContentSubject`, `ImportJob` for bulk imports, and the operator tables `AdminUser` / `AdminSession`
(Fase 4.5, §7f). A single generic table replaced the earlier split lecture/book models — the admin adapts to it in `src/lib/api.ts`
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

**Public payloads are positive lists (Fase 5.3).** `server/src/lib/public-payload.ts` names the fields
a visitor may see (`PUBLIC_CONTENT_KEYS`, `PUBLIC_SCHOLAR_KEYS`, `PUBLIC_SUBJECT_KEYS`) and maps every
public response through it, including nested join rows and the content embedded on a scholar page (only
`status = published`). `createdBy`, `updatedBy`, `importJobId` and scholar/subject `metadata` stay
server-side; `Content.metadata` **is** public because the public UI renders provider metadata from it
(archive `available_media`, `tags`, `publisher`, `isbn`). The admin endpoints keep returning the raw row
(the CMS shows attribution). Uploads are typed by their magic bytes (`server/src/lib/image-type.ts`), not
by the multipart `Content-Type`.

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
`ADMIN_TOKEN` header/bearer (only while `ADMIN_LEGACY_TOKEN` leaves that path enabled — off in
production since Fase 5.3, §7i), then the non-production localhost
convenience; `/api/admin/login` and `/api/admin/logout` are the only admin paths reachable without
credentials. Sessions are rolling (12 h default, `ADMIN_SESSION_TTL_MINUTES`, hard cap 30 days) and
are revoked when a password changes or an account is disabled. Login attempts are throttled
in-process (5 failures per username+IP, 20 per address, 15-minute window). Accounts are managed from
the server with `npm run admin:create|password|disable|enable|list`. Because the cookie is `Secure`,
the deployment needs HTTPS: the app sends HSTS on any request that arrives over HTTPS (directly or
via `x-forwarded-proto` from a trusted proxy) and can redirect plain HTTP itself with
`FORCE_HTTPS=true` — the proxy stays free of choice (`docs/DEPLOYMENT.md` §5b, §7g). The browser stores **no**
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
- `GET /api/health` reports service + database + upload storage (without paths or secrets) and returns
  **503** when the database is unreachable or the upload volume is not writable — use it to verify a
  deployment. `adminProtection` shows how the admin surface is guarded (`sessions`, or
  `sessions+legacy-token` when a host opted back into the token, §7i).
- **A production host must be able to sign someone in.** Accounts come from `npm run admin:create`;
  the legacy `ADMIN_TOKEN` is off unless the host sets `ADMIN_LEGACY_TOKEN=true`. With neither, the
  server refuses to start and says why (§7i, `docs/DEPLOYMENT.md` §5d).
- Configuration comes from the process environment only. A `.env` file supplying `NODE_ENV`,
  `ADMIN_TOKEN`, `CORS_ORIGIN` or `ADMIN_ALLOW_LOCALHOST` makes a production boot **refuse to start**
  (Fase 3.8.1). Reference: `docs/FASE3_8_1_ENV_SECURITY.md`.
- Uploads must live on a persistent volume (`UPLOADS_DIR`, e.g. `/var/lib/ilmnet/uploads`),
  otherwise images vanish on redeploy while the database keeps referencing them.
- **Backups are part of the deployment, not an extra**: `ops/backup.sh` writes a `pg_dump` + uploads
  archive + manifest, `ops/systemd/ilmnet-backup.timer` runs it nightly, and `ops/restore-drill.sh`
  proves the set restores. Procedure and the recorded drill result: `docs/DEPLOYMENT.md` §6b, §7g.
- Production reference data: `npm run seed:reference` (subjects + scholars only, never content).
  The destructive demo seed refuses to run in production.
  - `server/.env` in this repository is **development only** and stays untracked; in production the
    configuration comes from the process environment and operator accounts are created on the server
    with `npm run admin:create` (Fase 4.5). The browser only posts username + password to
    `POST /api/admin/login` and stores no credential at all (§7f).
  - **The admin CMS needs HTTPS** (or `localhost`/`127.0.0.1`): the session cookie is `Secure`, so a
    deployment on plain `http://<host>` signs in and then appears signed out (§8.12;
    `docs/DEPLOYMENT.md` §4b).
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
3. Every `/api/admin/*` request and every write requires either a valid session cookie or — only while
   `ADMIN_LEGACY_TOKEN` leaves it enabled — the `ADMIN_TOKEN`, which must be at least 16 characters and
   non-guessable; anything else is 401. **In production the legacy token is off by default** (Fase 5.3):
   a host that keeps using it for CI says so with `ADMIN_LEGACY_TOKEN=true`, and a boot with no active
   account and no token is refused (`No way in`). Passwords are scrypt-hashed (≥10 characters, no known
   defaults, never equal to the username); only the SHA-256 hash of a session token is stored.
   `CORS_ORIGIN` lists exact origins — a wildcard stops a production boot.
3b. **A public response is a positive list.** `server/src/lib/public-payload.ts` decides what leaves the
   server: no `createdBy`/`updatedBy`/`importJobId`, no scholar/subject `metadata`, and unpublished
   content never travels along (a scholar page used to include drafts). New columns are private until
   they are added to that file *and* to the tests.
3c. **Destructive actions must name their target.** `DELETE /api/admin/contents/:id?hard=true` (the
   genuinely irreversible one) and the scholar/subject deletes require `?confirm=<id|slug>`; the CMS
   makes the operator type the record's name first. Archive (DELETE without `hard=true`) is the
   reversible default and stays that way.
3d. **Uploads are recognised by their bytes** (`server/src/lib/image-type.ts`, JPEG/PNG/GIF/WebP/AVIF);
   the detected type decides the stored extension and the reported mime, the client's header only shapes
   the error message. The public health payload does not disclose the upload directory either.
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
9. **A database dump is a secret**: it holds the scrypt hashes of the admin accounts. Backups are
   written outside the checkout (`.gitignore` also covers `backups/`), with mode 0600, and a restore
   only ever targets a database named explicitly on the command line (`ops/restore.sh` refuses
   anything else, and refuses to overwrite a non-empty uploads directory without `--force`).

## 6. Testing

| Command | What it covers | Last verified result |
| --- | --- | --- |
| `npx tsc --noEmit` (root + `server/`) | types | 0 errors (Fase 5.3) |
| `npm run build` (root) | single-file production build | 645.98 kB / 161.40 kB gzip (Fase 5.3) |
| `cd server && npm run test:all` | audit, uploads (**30**), production readiness (**103**, incl. TLS/HSTS, proxy trust, boot guards, readiness, public payload, delete confirmation, magic bytes, admin posture), env hardening (13), youtube (+ Data API fallback), **auth (69)** | green in Fase 5.3: exit 0, **288 ✅** (the live YouTube scrape check can still fail when Google throttles this IP — §8.11) |
| `ops/backup.sh` + `ops/restore-drill.sh` | database + uploads backup, then a restore into a throwaway database with count and checksum comparison | drill PASSED in Fase 5.1 (seven tables + two upload files, §7g) |
| `cd server && npm run test:imports` | live Archive.org + YouTube import regression | 19/19 whenever the provider answers; the live scrape check is the part that fails under Google's throttle (§8.11) |
| `npm run test:e2e:production` | routes, embeds, **real YouTube playback**, error states, mobile, admin entry (login gate), **footer navigation (17 checks)** | 84/84 (Fase 5.1/5.3) |
| `npm run test:e2e` | waveform, thumbnails, admin upload flow | 27/27 |
| `npm run test:e2e:cms` | admin CMS: real totals, draft→published→archived→restored, collection round-trip, 401 honesty, **typed delete confirmation + `CONFIRM_REQUIRED`** | 34/34 (Fase 5.3) |
| `npm run test:e2e:auth` | Fase 4.5 gate: username/password sign-in, 401s, cookie flags, deep link, refresh, tampered cookie, server-side logout, no credential in web storage, public site stays free | 60/60 |

Browser specs take `SITE_URL`, `API_URL`, `ADMIN_TOKEN` (for their API fixtures) and sign the
browser in with `ADMIN_USERNAME`/`ADMIN_PASSWORD` (usernames default to `e2e-admin` for the
production suites and `media-e2e-admin` for the media suite; the **password has no default** — no
credential is committed — so create the account with `npm run admin:create` and export
`ADMIN_PASSWORD`); the server suite
takes `TEST_ADMIN_TOKEN`. The browser specs still send that token for their API fixtures, so a
production server used for e2e needs `ADMIN_LEGACY_TOKEN=true` — that is the CI case §5d describes;
`tests/e2e/lib/admin-session.mjs` holds the shared sign-in helper (it logs
in over the API and hands the session cookie to the browser context — nothing is injected into
JavaScript-visible storage). The server suite needs an explicit mode next to a deployment variable
(`NODE_ENV=test ADMIN_TOKEN=… npm run test:all`) — a boot that sees `ADMIN_TOKEN` without `NODE_ENV`
refuses to start (Fase 3.8.1). `test:e2e:auth` and `test:e2e:production` expect a production server
(`NODE_ENV=production`, the same `ADMIN_TOKEN`, `ADMIN_LEGACY_TOKEN=true` to keep the fixture token
working, matching `CORS_ORIGIN`). Mutating suites clean up their
own records — verify afterwards, and never point them at a database whose content must be preserved.
Known quirk: `test:imports` deliberately leaves the imported record in place (that is part of what it
asserts), so run it against a throwaway database or remove the record afterwards.

**State of these numbers (Fase 5.3):** measured in the same rebuilt sandbox (PostgreSQL 17.11, real
Archive.org/YouTube imports: 25 published records — 8 books, 7 videos, 10 audio — plus 8 scholars and
11 subjects, in both `ilmnet` and `ilmnet_prod`). The production readiness suite grew 44 (Fase 4.5) →
54 (5.1) → 76 (5.2) → **103** (5.3: public payload, delete confirmation, magic-byte uploads, admin
posture, and the health payload); uploads 25 → **30**. The sandbox is ephemeral (dependencies, database
and processes are not part of the snapshot): rebuild and re-run per `AGENTS.md` §4 before quoting these
again. The e2e suites were run against a production server on `:3101` whose `ADMIN_LEGACY_TOKEN=true`
stands in for a CI host — the sessions-only posture is proven separately in the server suite and with
real boots (see §7i).

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

## 7c. What Fase 4.1 (admin authentication) changed (the gate stands, the credential model does not)

> The **gate** and its behaviour are still in place — the CMS cannot render before the API has
> confirmed a caller. The **credential model described below is history**: since Fase 4.5 the browser
> signs in with a username + password and keeps nothing, the session lives in an
> `HttpOnly; Secure; SameSite=Lax` cookie, and `sessionStorage`, `x-admin-token`,
> `verifyAdminSession()` and the `admin-login-token` field no longer exist anywhere in the code
> (§7f).

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

- **TinyCMS is scrapped, definitively.** The Fase 4 commit (`45fc54a`) still carries that working name
  in its message, and the phase itself delivered an admin CMS. Since Fase 4.2 the name, the CMS
  framework idea and the content layer it implied are absent from every file, and Fase 4.5.1 also
  removed them from the roadmap (§9). Do not reintroduce the name, a CMS framework or a content layer
  for website texts: the admin talks to the Fastify+Prisma API directly and fixed copy lives in the
  React components.

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
- **“Error 153” (Fase 4.3.1 — diagnosis only, no code change).** YouTube's embedded player must
  identify itself through the HTTP `Referer`. The diagnosis in a real browser against the production
  server showed this repository is correct: `server/src/server.ts` sends
  `referrer-policy: strict-origin-when-cross-origin` (the value YouTube recommends), there is no CSP
  and no `X-Frame-Options`, and the player iframe in `src/pages/ContentDetail.tsx` has neither
  `sandbox` nor `referrerpolicy`. All seven imported videos loaded with a valid `Referer` and no error.
  The failure only appeared when the `Referer` was suppressed on purpose — by a layer that rewrites the
  `Referrer-Policy` response header to `same-origin`/`no-referrer`, or by a document without a usable
  origin (`sandbox="allow-scripts"` without `allow-same-origin`, `srcdoc`, a WebView without a base
  URL). Conclusion: the `Referer` is lost in the deployment layer around the app, not in our code.
  Production check: `curl -sI https://<domain>/` must literally show
  `referrer-policy: strict-origin-when-cross-origin`, and DevTools → Network (filter `embed/`) must
  show a `Referer` for the YouTube request.
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

## 7g. What Fase 5.1 (production blockers) changed

The read-only Fase 5 audit named exactly three blockers. Fase 5.1 closed those three and nothing else.

**1. Backup and restore (`ops/`, new).** No new dependencies: the scripts use `pg_dump`, `pg_restore`,
`psql` and coreutils.

- `ops/backup.sh` writes one timestamped set into `BACKUP_DIR` (mode 0600, retention via
  `RETENTION_DAYS`): a `pg_dump --format=custom`, a `tar.gz` of `UPLOADS_DIR` and a manifest with the
  row counts at backup time plus sha256 per file. A dump that `pg_restore --list` cannot read fails the
  run instead of passing silently.
- `ops/restore.sh` puts a set back. The target database must be named explicitly (`--database-url`),
  `--recreate` (DROP + CREATE) additionally requires `--yes`, a non-empty uploads directory needs
  `--force`, and the dump is validated before anything is touched. Both scripts accept the same
  `DATABASE_URL` as the app: the Prisma-only query parameters (`schema`, `connection_limit`, …) are
  stripped before the client tools see the URL — the very first drill run failed with
  `pg_dump: error: invalid URI query parameter: "schema"`, which is exactly what a drill is for.
- `ops/restore-drill.sh` proves a set restores **without touching live data**: it restores into the
  throwaway database `ilmnet_restore_drill` through the real `restore.sh`, extracts the uploads into a
  temporary directory, and compares row counts and per-file sha256 with the manifest.
- `ops/systemd/ilmnet-backup.{service,timer}` + `ops/systemd/backup.env.example` schedule the nightly
  run (02:30, random delay, `Persistent=true`); `ops/README.md` is the one-screen overview. Full
  procedure, off-site advice and troubleshooting: `docs/DEPLOYMENT.md` §6b.

**Recorded drill result (Fase 5.1, real data, no mocks).** The sandbox database held 8 published
Archive.org books (with scholars/subjects linked), 4 import jobs, 1 admin account and 2 uploaded
covers; the dump had 62 restorable objects (29,096 bytes) and the uploads archive 20,418 bytes.

```
table                manifest   restored       live   verdict
contents                    8          8          8   PASS
scholars                    8          8          8   PASS
subjects                   11         11         11   PASS
content_scholars            8          8          8   PASS
content_subjects           16         16         16   PASS
import_jobs                 4          4          4   PASS
admin_users                 1          1          1   PASS
uploads (files)             2          2        –   PASS
uploads (sha256)            2          2        –   PASS
drill PASSED — the backup set restores into an empty database with matching counts.
```

The restored environment was then **served** by a real API instance (pointing at the drill database and
the extracted uploads): `/api/health` ok, `/api/contents` → `total=8` with the first restored title
(`Usool At Tafseer`, provider archive, 1 scholar, 2 subjects), the detail route 200, and the restored
file at `/uploads/drill-cover-a-…jpg` served as `image/jpeg` (17,770 bytes).

**2. Honest footer (`src/components/SiteFooter.tsx`).** Before: twelve labels — *Our approach*,
*Sources & attribution*, *Contributors*, *Contact*, *Collections*, *Beginners path*, *New additions*,
*Series* — all rendered as `<Link to="/">`, so every one of them silently landed on the landing page and
promised pages that do not exist. Now the footer links only what exists: the four public list routes
plus the Lectures filters the page itself writes to the URL (`/lectures?type=audio|video`), and the
*About* column is honest static text about sourcing instead of four dead links. `tests/e2e/production.spec.mjs`
asserts it in the real browser: every footer `href` is in the set of real routes, none of the old labels
survive, and each link opens its own page with the right heading (and, for the filter links, the active
chip) — 17 new checks.

**3. TLS, HTTPS, HSTS and HTTP→HTTPS (`server/src/server.ts`, docs).** The app now sends
`Strict-Transport-Security: max-age=…` (`HSTS_MAX_AGE`, default one year, `0` disables) **only** on
requests that really arrived over HTTPS — direct TLS or `x-forwarded-proto` from a trusted proxy — so
plain HTTP stays honest and local development is unaffected. `includeSubDomains`/`preload` are
deliberately not set. `FORCE_HTTPS=true` (production only, opt-in) answers plain HTTP with a **308** to
the same URL, keeping method and body, using `x-forwarded-host` when the proxy supplies it; health
endpoints stay reachable over plain HTTP so the container `HEALTHCHECK` on the app socket keeps working.
`Referrer-Policy: strict-origin-when-cross-origin` is untouched (YouTube needs it, Fase 4.3.1) and the
boot log now states the HSTS/redirect posture. No provider is assumed: `docs/DEPLOYMENT.md` §5b
describes what the proxy must do (terminate TLS, forward `X-Forwarded-Proto`, redirect) and how to
verify it with `curl -sI` on the live domain.

**Smaller items in the same commit.**

- `.gitignore` ignores `backups/`; `server/.env.example` documents `HSTS_MAX_AGE` and `FORCE_HTTPS`.
- `server/test/production.test.ts` grew from 44 to 54 checks: HSTS present over https and absent over
  http, `HSTS_MAX_AGE=0`, `referrer-policy` unchanged, 308 redirect with forwarded host and with the
  connection host, https requests not redirected, health exempt.
- `server/test/youtube.test.ts` §7d asserted that "the newest youtube import job exists" — true only
  when an earlier run had left a row behind (the suite deletes its own jobs), so it failed on a clean
  database. It now proves the invariant it was written for: a service-level preview writes nothing and
  no stored import job contains the API key. Test-only change; the product code was not involved.
- `AGENTS.md` and `README.md` point at the backup/restore commands; `docs/DEPLOYMENT.md` gained §5b
  (TLS/HSTS) and §6b (backup/restore/drill) plus three troubleshooting rows.

**Verified in this phase (commands and numbers).** `tsc --noEmit` clean in `./` and `./server`;
`npm run build` → 644.91 kB / 161.10 kB gzip; `test:all` exit 0 — audit, uploads 25/25, production
readiness **54/54**, env hardening 13/13, YouTube (live, including the Data API fallback) and auth 69/69;
`test:e2e:production` **84/84** against a production server with the 18 real records; `test:e2e:auth`
60/60 against the same server; the restore drill PASSED as shown above.

## 7h. What Fase 5.2 (deployment hardening) changed

The Fase 5 audit's IMPORTANT list contained deployment items that *are* verifiable from the repository.
Fase 5.2 implemented those and left the environmental ones to the host (§8.14). No new dependencies,
no schema change, no redesign.

**Forwarded headers are no longer trusted blindly.** The server ran with Fastify's `trustProxy: true`,
which lets any client set `X-Forwarded-For` (the login throttle, `AdminSession.ip` and the logs all
believe it), `X-Forwarded-Proto` (the app would send HSTS for a plain-HTTP request) and
`X-Forwarded-Host` (the redirect target). New `server/src/lib/proxy.ts`:

- `TRUST_PROXY` is the single switch, default **false** — nothing is trusted, the socket address is
  the client. `true` is an explicit opt-in for an API that is only reachable through the proxy; a
  comma-separated list of IPs/CIDRs (`127.0.0.1`, `10.0.0.0/8`) is the recommended form and is passed
  to Fastify unchanged.
- A hop count (`TRUST_PROXY=2`) is refused at boot: it silently trusts the wrong hop as soon as the
  topology changes. The literal strings `undefined`/`null` count as unset, because
  `process.env.X = undefined` stores the *string* `"undefined"` — that would otherwise become a proxy
  address called “undefined” (the test suite hit exactly that).
- The HTTP→HTTPS redirect target comes from `PUBLIC_ORIGIN` (canonical, the request cannot influence
  it) or, failing that, from a host on the allowlist (`CORS_ORIGIN`, `ALLOWED_HOSTS`). A host that is
  not allowlisted is replaced by the canonical origin and logged as a warning — a forged
  `X-Forwarded-Host: evil.example` never reaches a visitor. Without any allowlist the app refuses to
  redirect at all and says so in the log (the proxy should do it).
- Boot guards: `FORCE_HTTPS=true` without a trusted proxy (guaranteed redirect loop) or without any
  redirect target is refused before the port is opened, with a message that names the fix.
- The boot log states the effective posture (`Proxy trust: …`, `Client IP source: …` when trust is
  off in production), so a misconfigured proxy is visible without guessing.

**Health vs readiness.** `/api/health` stays the deep check (database **and** upload storage, 503 when
either is unusable — the Dockerfile HEALTHCHECK keeps using it). New `/api/ready` (+ `/api/v1/ready`)
is the cheap probe for a load balancer: a database ping, `{ status: "ready", database: "up" }`, 200/503,
no credentials. Both stay reachable over plain HTTP and are exempt from the `FORCE_HTTPS` redirect, so
a probe on the app socket keeps working.

**Network exposure in `server/docker-compose.yml`.** Postgres no longer publishes a port at all
(`expose` on the compose network; `docker compose exec postgres psql …` for a one-off session, and a
commented-out loopback mapping if host access is truly needed) and `POSTGRES_PASSWORD` is required
instead of defaulting to `ilmnet_dev` — the same pattern the API token already used. The API publishes
`127.0.0.1:3001` instead of `3001:3001`, so only a proxy on the host can reach it, and `TRUST_PROXY`
appears with its safe default plus a `PUBLIC_ORIGIN` slot. **The compose file was also not valid YAML
before this phase**: the unquoted `${ADMIN_TOKEN:?…: …}` interpolation contains a second colon and
`docker compose` would have refused the whole file — it is quoted now (both the token and the new
password guard), and the file parses.

**Docs.** `docs/DEPLOYMENT.md` gained §5c (the three forwarded headers, what each one controls, how to
set `TRUST_PROXY`, an nginx example that sets `X-Forwarded-*` itself, how to verify with the log and a
failed login), a liveness-vs-readiness table in §8, a network bullet in the Docker section, an extra
verification step and six new troubleshooting rows. `server/.env.example` documents `TRUST_PROXY`,
`PUBLIC_ORIGIN` and `ALLOWED_HOSTS`; `AGENTS.md` carries the rule; `README.md` mentions the endpoints.

**Verified in this phase.** `tsc --noEmit` clean in `./` and `./server`; `test:all` exit 0 — audit,
uploads 25/25, production readiness **76/76** (was 54: +22 checks for proxy trust, the redirect
allowlist, the boot guards, the `undefined` footgun and the readiness probe), env hardening 13/13,
YouTube live, auth 69/69. `npm run build` unchanged at 644.91 kB / 161.10 kB gzip (no frontend code was
touched). Compose validated as YAML with a parser.

## 7i. What Fase 5.3 (data & security hardening) changed

Fase 5.3 closed the data-safety items of the Fase 5 audit (I6, I7, I8, plus the health-payload leak)
inside the existing architecture: **no new dependencies, no schema change, no redesign**. It touched
the server (`lib/env.ts`, `lib/image-type.ts`, `lib/public-payload.ts`, `lib/validation.ts`,
`server.ts`, `routes/{health,uploads,content,scholar,subject}.ts`), the admin frontend (`lib/api.ts`,
`admin/ui.tsx` and the four list pages) and the tests. `src/admin/store.tsx` was deliberately left
alone: `api.ts` defaults `confirm` to the record id, so existing callers keep working and a caller
that already passes a phrase cannot be bypassed.

**1. The legacy token is off in production (audit I6).** `ADMIN_LEGACY_TOKEN` is the explicit switch
(`legacyAdminTokenEnabled()`): `true` = on, `false` = off, unset = **on in development, off in
production**. The consequences are enforced in `assertAdminAccessPossible()` and `server.ts`:

- `ADMIN_LEGACY_TOKEN=true` without a usable `ADMIN_TOKEN` refuses to boot
  (`ADMIN_LEGACY_TOKEN=true is set, but ADMIN_TOKEN is missing: the legacy token would authenticate
  nobody …`).
- Production with no active `admin_users` row and the token off refuses to boot
  (`No way in: the legacy ADMIN_TOKEN is disabled in production and the admin_users table has no
  active account …`) — a documented, deliberate hard stop, because such a host could never sign in.
- A production host that sets `ADMIN_TOKEN` without opting in gets a warning saying it is ignored
  (`ADMIN_TOKEN is set but the legacy token path is disabled in production`), so a forgotten secret is
  never silently useless.
- The boot log now reports the posture with the account count: `Admin protection: session sign-in
  enabled (N active account(s)) · legacy ADMIN_TOKEN fallback enabled/disabled`, and the auth hook only
  accepts the token on the branch where it is enabled.
- `GET /api/health` was reworded to carry **no secret material**: `adminProtection` is now the posture
  string (`"sessions"` or `"sessions+legacy-token"`), and `storage.dir` — the absolute upload path —
  was dropped from a public payload.

**2. Public responses are positive lists (audit I8).** `server/src/lib/public-payload.ts` defines
`PUBLIC_CONTENT_KEYS` / `PUBLIC_SCHOLAR_KEYS` / `PUBLIC_SUBJECT_KEYS` plus `INTERNAL_CONTENT_KEYS =
[createdBy, updatedBy, importJobId, importJob]` and maps every public payload through them — list and
detail alike, including the nested join rows (`scholars`, `subjects`, `contents`) and the content a
scholar page embeds. It also fixed a real leak: the scholar detail used to return drafts. `Content.
metadata` stays public on purpose (the public UI renders archive tags/publisher/ISBN from it), while
scholar and subject `metadata` do not leave the server. The admin endpoints still return the raw row,
so the CMS keeps showing attribution — and `production.test.ts` asserts both sides, with a
`findKeysDeep` walk that fails on any internal key anywhere in a public response.

**3. Irreversible deletes must name their target (audit I7).** `DELETE /api/admin/contents/:id?hard=true`
now also needs `?confirm=<id|slug>` (`400 CONFIRM_REQUIRED` with a message naming the record); archiving
(hard absent) stays the reversible default and is unchanged. Scholar and subject deletes take the same
`confirm` (their `409 … linked to N contents. Unlink first.` guard was already correct and was **not**
loosened — see the correction in §8.9-style audit note: the audit's I7 reading of those routes was
wrong). A successful hard delete is logged at `warn` with operator, id, slug and title. In the CMS,
`ConfirmDialog` gained a `requirePhrase` mode (`data-testid="confirm-phrase"`): the operator types the
record's name and the destructive button stays disabled until it matches; `cms.spec.mjs` proves the
disabled/enabled transition, a wrong phrase, and that cancelling deletes nothing.

**4. Uploads are recognised by their bytes.** `server/src/lib/image-type.ts` sniffs the first 32 bytes
for JPEG/PNG/GIF/WebP/AVIF (SVG is deliberately not accepted — it is a scriptable document; the CMS
only ever renders a custom image thumbnail, so nothing needed it). `routes/uploads.ts` buffers the
stream (`peekStream`), answers `400 EMPTY_FILE` for an empty body and `415 UNSUPPORTED_TYPE` when the
bytes do not match a supported image, and stores `detected.ext` with the detected mime instead of
trusting the multipart filename/type. Fixing this surfaced a real bug: `peekStream` only returned the
overflow beyond the sniff window, so large uploads were stored truncated — it now returns every byte it
buffered. `test/uploads.test.ts` covers PNG-as-JPEG, HTML-as-PNG (415), an empty upload and a real
JPEG (201), and compares stored bytes with the sent bytes.

**5. Logs and errors.** Re-verified rather than rewritten (the Fase 4.5/4.3 redaction already covered
this): `pino` redacts the token and password paths, the rejected-login line logs `username`, `ip` and
`reason` but never the password (`{"level":40,…,"reason":"bad_password","msg":"Admin sign-in
rejected"}`), and a live check on the running production server found **0** occurrences of the admin
token, of `x-admin-token`, and of a unique marker password in the log — including the request that
used the token. Nothing new needed to change.

**Verified in this phase.** `npx tsc --noEmit` clean in `./` and `./server`; `npm run build` exit 0
(645.98 kB / 161.40 kB gzip); `cd server && npm run test:all` exit 0 with **288 checks** (audit,
uploads 30, production readiness 103, env hardening 13, youtube, auth 69). Three real boots proved the
posture: no account + token off → exit 1 with `No way in…`; `ADMIN_LEGACY_TOKEN=true` without a token →
exit 1 with the missing-token message; an account present → boot with
`session sign-in enabled (1 active account) + legacy ADMIN_TOKEN fallback`. End-to-end against a
production server on `:3101` serving the real `dist/` with a real `ilmnet_prod` database: production
**84**/84, admin-auth **60**/60, cms **34**/34, media **27**/27. The e2e suites talk to the API with the
legacy token, so that server is started with `ADMIN_LEGACY_TOKEN=true` — a CI host is the one legitimate
reason to keep the fallback, and §5d of `docs/DEPLOYMENT.md` says so explicitly.

**Not changed on purpose:** no schema change and no new dependency (the sniffing is ~30 lines of
`node:buffer`), the public site stays login-free, and the CMS keeps its neumorphic look. Follow-ups that
were considered and left: the `__Host-` session cookie prefix (needs a code-level `Max-Age`/TTL review,
§8.15), a public-API rate limit and the audit-log table (host/roadmap items, §8.4/§8.9).

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
    the reverse proxy: the app helps (HSTS on https requests, optional `FORCE_HTTPS` redirect) but
    cannot terminate TLS itself (`docs/DEPLOYMENT.md` §5b).
13. **`VITE_ADMIN_TOKEN` is obsolete** (Fase 4.5): the frontend no longer reads it. Existing local
    `.env` files that still set it are harmless but should be cleaned up; `AGENTS.md` keeps the rule
    that no credential may come from `VITE_*`.

14. **Host-side items the repository cannot verify.** Fase 5.2 moved as much of this as possible into
    the code (defaults that trust nothing, an allowlisted redirect target, boot guards for the
    dangerous combinations, a readiness probe, no published database/API port in compose), so what is
    left is genuinely environmental: terminating TLS and renewing certificates; forwarding
    `X-Forwarded-Proto` and choosing the real `TRUST_PROXY` value for that topology (a proxy that does
    not forward the scheme makes `FORCE_HTTPS` unusable — the boot guard will tell you); the nightly
    `ilmnet-backup.timer` running elsewhere than a test host; off-site copies; the monthly
    `ops/restore-drill.sh`; rate limiting in front of the public API; uptime monitoring/alerting and a
    resource/pool budget for the real traffic (audit I2, I9, L13). `docs/DEPLOYMENT.md` §5b/§5c/§6b
    holds the exact commands and install steps, including the log lines and `curl` checks that prove
    each one.

15. **The session cookie is not `__Host-`-prefixed** (Fase 5.3 reviewed and left this). The cookie is
    already `HttpOnly`, `Secure` and `SameSite=Lax`, and it is set with `Path=/` on the host itself —
    so it is not exploitable by a sibling subdomain today. Moving to `__Host-ilmnet_session` is a
    cheap extra layer but changes the cookie name (an existing session would have to sign in once
    more) and needs one place to keep the `Max-Age`/expiry contract; do it together with any other
    cookie change.

## 9. Next step

No open blockers. Fase 4.5 replaced the shared token with real accounts, sessions and attribution
(§7f); Fase 4.3.1 proved the YouTube “Error 153” is not caused by this repository (§7e); Fase 4.3
verified YouTube import and playback (§7e); Fase 4.2 removed the leftover naming and dead helpers
(§7d); Fase 4.1 put the CMS behind a login (§7c). Every suite is green — except the live YouTube
scrape check when Google throttles this IP (§8.11), which is external and passes again after a pause.

**The roadmap is production finishing, UI/UX and performance toward the definitive live deployment.**
Fase 5.1 removed the three blockers that were verifiable in the repository; the rest starts on the host.

- **Phase 5.3 — data safety (done, §7i).** The legacy token now needs `ADMIN_LEGACY_TOKEN=true` in
  production (and its absence without an account stops the boot), public payloads are positive lists,
  hard deletes must name their record, uploads are validated by magic bytes, and the health payload no
  longer publishes the upload path.
- **Phase 5.4 — scale and speed.** Server-side pagination and real totals on the public lists
  (§8.2/I10), a trigram index for the `ILIKE` search (§8.3/L1), cache headers (L3) and a performance
  budget next to the bundle measurement (L2/L12).
- **Phase 5.5 — polish and compliance.** Self-hosted fonts and a privacy/contact page beyond the
  footer text (audit I5), `robots.txt`/`sitemap.xml`/favicon/Open Graph (L9), README and `.env.example`
  drift (L10).

TinyCMS is **not** on the roadmap: the name, the CMS framework and a content layer for website texts
are scrapped permanently (Fase 4.2/4.5.1, §7d) and must never be reintroduced. The remaining
candidates from the Fase 4.4 audit stay available as follow-ups without being planned: account
management in the UI, roles/permissions, 2FA, a shared throttle store for multi-instance deployments
and an audit-log table (§8.9). Before starting: `git status`, `git log --oneline -3`, and re-read this
file.

## 10. How to keep this file accurate

- After every commit that changes state: update §1 (commit, status) and, if relevant, §7/§8.
- After a sanity check: record the verification outcome with numbers, and add anything the check
  discovered to §8.
- After a phase: add a row to §2 and refresh §9.
- Keep it free of secrets, of live/deployment-specific values, and of claims you cannot point to in
  code, Git history or the docs under `docs/`.
