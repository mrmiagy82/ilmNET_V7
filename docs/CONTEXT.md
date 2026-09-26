# ilmNet — CONTEXT

Living document for AI/OpenCode sessions. **Read this before touching code** (see `AGENTS.md`).
Update it after every finished phase, commit, sanity check or significant discovery.
Rules: only facts that are verifiable from the repository, Git history or existing docs — and
**never** secrets, tokens or credentials.

_Last updated: Fase 6.1 (26 September 2026): eight transparent path-only SVG reconstructions,
shared BrandLogo integration and 222/222 focused branding checks — §7o. Original raster references,
favicons and backend/auth/database code are unchanged. Git delivery still requires configured safe
push authentication; do not infer remote equality from this document._

The last phases: Fase 5.1 closed the three blockers from the Fase 5 audit (backup + restore, honest
footer links, TLS/HSTS with a provider-agnostic runbook, §7g). Fase 5.2 hardened the deployment
itself: forwarded headers are only trusted when `TRUST_PROXY` names a proxy, the HTTP→HTTPS redirect
can no longer be steered by a forged host, a `FORCE_HTTPS` misconfiguration is refused at boot,
Postgres is no longer published by the compose file (which was not even valid YAML before), and the
API gained a cheap readiness probe (§7h). Fase 5.3 then closed the data-safety items of the audit
(I6/I7/I8/L4): the legacy shared token is off in production by default, public responses are built
from a positive list (no `createdBy`/`updatedBy`/`importJobId`, and no draft content on a scholar
page), an irreversible delete must name its record in the API and in the CMS, and uploads are
recognised by their magic bytes instead of the client's `Content-Type` (§7i). Fase 5.4 then measured
the public path against a real 20 000-record database and fixed what the numbers showed: a series page
searched the whole table instead of using its index (0,60 s → 0,03 s), every list response carried
~1,5 kB per record of data no card renders (−35 % bytes), and the single-file bundle was delivered
uncompressed (631 kB → 157 kB over the wire, −2,3 s on a 3G profile) (§7j).

---

## 1. Current status

| | |
| --- | --- |
| Branch | `master` |
| Codebase state described here | `ae1c746` (Fase 6.0) + Fase 6.1 (§7o); this document ships with the SVG reconstruction commit |
| This document | updated in Fase 6.1; its own revision is visible with `git log -1 -- docs/CONTEXT.md` |
| Working tree | the phase began clean at `master == origin/master == ae1c746`; verify the current delivery state with `git status -sb` and both commit IDs — push is not confirmed at this documentation checkpoint |
| Repository | `github.com/mrmiagy82/ilmNET_V7` |
| Size | 77 files under `src/` + `server/src/` (76 `.ts`/`.tsx`, 17 184 lines). `public/brand/` now has 34 files, including eight new SVGs (98 962 B total); original PNG/WebP references remain unchanged |
| Build (git-ignored artefact) | Fase 6.1: single-file `dist/index.html` 658 219 B / `dist/index.html.gz` 163 620 B, plus unchanged self-hosted `dist/fonts/` and `dist/brand/` including the eight SVGs. The production preview serves the exact SVG files, checked by byte equality |
| Phase state | Fase 6.1 implementation and scoped verification done: eight vector variants, transparent symbol/wordmark/descriptor paths, SVG-only BrandLogo, unchanged header/footer/admin placements, 222/222 brand checks. Full database/auth/media/runtime suites were not rerun; earlier results below remain historical. Git push is a remaining delivery prerequisite (§7o) |
| Roadmap | production finishing, UI/UX and performance toward live deployment (§9). The Fase 6.1 logo work is validated locally; Git delivery still needs safe authentication. Host-side work and optional follow-ups remain as previously documented, not freshly re-audited here |
| Brand | Fase 6.1: `public/brand/logo/*.svg` are true, path-only reconstructions of the supplied branding references, not original vector masters. Original font and tiny descriptor details cannot be authenticated; see `brand/SVG_RECONSTRUCTION.md`. The favicon/app icon set and official theme tokens from Fase 6.0 are retained |
| Open blockers | SVG delivery: safe GitHub push authentication was not configured at the validation checkpoint, so push / `local == origin/master` is not confirmed. No database or full production verification was performed in this branding-only phase; earlier host-side and known-issue lists (§8) are carried forward, not declared resolved |

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
| `5b1372d` | Fase 5.3 | data & security hardening: legacy token off in production, whitelisted public payloads, confirmed destructive deletes, byte-verified uploads, no path leak in health (see §7i) |
| `7d090c7` | Fase 5.4 | performance & scale: measured on 20 000 records — reduced list payload, index-backed series filter, SPA fallback via the static handler, pre-compressed bundle (see §7j) |
| `dd33ea6` | Fase 5.5 | production polish: API JSON compression, self-hosted fonts, per-route meta + Open Graph, 404 page, `robots.txt`/`sitemap.xml`/favicon/manifest, skip link, honest empty states, English-only public copy, security headers, root-absolute asset URLs (see §7k) |
| `0011ac6` | Fase 5.6 | operations & monitoring: watchdog (`healthcheck.sh`), alert delivery (`alert.sh`), off-site copy with manifest verification (`offsite-copy.sh`), post-deploy/rollback smoke test (`deploy-check.sh`), release identity + `LOG_LEVEL` in the API, systemd units + logrotate example, host-only checklist (see §7l) |
| `f5fcad6` | — | the delivered brand package (32 files under `brand/`), uploaded through the GitHub UI |
| `ae1c746` | Fase 6.0 | brand implementation: the official logo assets replace the code-drawn mark and wordmark, the official icon set replaces the self-made favicon, official colour tokens in `index.html`/`manifest.webmanifest`/`@theme`, the social card deliberately not published (§7n) |
| `b07703e` | Fase 5.6.1 | audit fixes from the Fase 5.1–5.6 end-audit: the restore drill refuses to pass without a comparison, `alert.sh` escapes every JSON value, the watchdog reports the release and prints failures even with `--quiet`, the systemd unit no longer treats a script error as success, `SearchBar` has a real accessible name, and the wrong HSTS/`archive.*`/test-data claims are corrected (see §7m) |
| _this phase commit_ | Fase 6.1 | eight transparent, path-only SVG reconstructions; SVG-only shared BrandLogo in the unchanged header/footer/admin slots; vector regression suite and reconstruction/fidelity documentation (§7o). Git push remains unconfirmed until safe credentials are configured |

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

**List vs detail payloads (Fase 5.4).** A *list* response (up to 100 records) uses the reduced
projection in `public-payload.ts`: `publicContentList` keeps exactly the same top-level keys but
carries only the media keys `metadata` needs for a card (`youtube.thumbnail`, `googleBooks.thumbnail`,
`archive.thumbnail`, `archive.cover`, `archive.item.thumbnail`, `thumbnail`/`image`/`cover` — precisely
the keys `src/lib/thumbnail.ts` reads; the *rest* of an `archive` object, e.g. its file list, is
detail-only) and card-shaped
nested rows (`id, slug, name, initials, accent` for a scholar, `id, slug, name, group, accent` for a
subject). A *detail* response keeps the full public shape (bio, tags, publisher, ISBN, the content a
scholar page embeds). The public list also accepts `collection=<collectionIdentifier>` for an exact,
index-backed series filter — `q=<identifier>` remains the free-text search it always was.

**Delivery (Fase 5.4).** `npm run build` writes `dist/index.html.gz` with `node:zlib`
(`scripts/precompress.mjs`, no dependency) and `@fastify/static` serves it when the client sends
`accept-encoding: gzip` (`preCompressed: true`); a deep link goes through `reply.sendFile` (async,
ETag/Last-Modified) instead of a synchronous `readFileSync` of the whole bundle. The API itself does
not compress JSON — gzip for `/api` belongs in the reverse proxy (`docs/DEPLOYMENT.md` §5c).

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

**Branding (Fase 6.0).** The official brand package lives in `brand/` (source) and its production files in
`public/brand/{logo,icon,favicon,og,social}/` — copied verbatim, never redrawn. `src/components/Brand.tsx`
exports one component, `BrandLogo`, which renders a delivered file inside a `<picture>` (WebP first, PNG
fallback) with the file's real `width`/`height` attributes and the aspect ratio on the wrapper; the size
comes from a Tailwind class (`h-9 sm:h-10`, `w-32`, `h-11`). The header and footer use the **primary**
logo (the widest supplied wordmark: 40 px tall = exactly the package's 120 px desktop minimum, 36 px =
108 px on small screens), the admin sign-in screen the **stacked** one, the admin sidebar the
**small-scale** one and compact chrome the **icon-only** one. The old hand-drawn `Mark`/`Wordmark` SVG are
gone, as is the self-made `favicon.svg`/`favicon.ico`/`icon-192`/`icon-512` set — the package has no SVG
master and no `.ico`, and inventing one is out of scope. Colour: `#A2AB73` and `#CC3A63` were already
`--color-olive` and `--color-rose`; the official tokens `--color-brand-bg #f3ebdd`, `--color-surface
#ffffff` and `--color-charcoal #1f2933` are added to `@theme`, and `theme-color`/`theme_color` now carry
`#F3EBDD`. The existing cream/sand surfaces and the `--color-ink` text colour were **not** recoloured: that
is a redesign, not a brand implementation.

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
  archive + manifest, `ops/systemd/ilmnet-backup.timer` runs it nightly, `ops/offsite-copy.sh` copies the
  sets off the host and verifies them against the manifest, and `ops/restore-drill.sh` proves the set
  restores (Fase 5.6 ran that drill **from an off-site copy**). Procedure and results:
  `docs/DEPLOYMENT.md` §6b, §7g, §7l.
- **Monitoring is scripted, alerting has a real path (Fase 5.6)**: `ops/healthcheck.sh` is the watchdog
  (deep health, readiness, uploads writability, backup freshness, disk, optional database), `ops/alert.sh`
  delivers a failure to a webhook or mail (with the message copy on stderr), `ops/deploy-check.sh` proves
  a deploy/rollback (11 checks + `--expect-commit`), and `/api/health` reports `version`, `commit` and
  `uptime` so the release that answers is identifiable. `LOG_LEVEL` changes verbosity without a code
  change. Units and a logrotate example ship in `ops/systemd/` and `ops/logrotate/`; the host-only list is
  `docs/DEPLOYMENT.md` §9f.
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

**Fresh Fase 6.1 verification:** both TypeScript checks and the frontend build passed; the new
`test:e2e:brand` passed **222/222** on the static production preview. Full database-dependent,
authenticated CMS, media/provider and backend runtime suites were not rerun in this phase. Their
Fase 6.0/5.x totals below are historical, not a claim about a new full-stack run.

| Command | What it covers | Last verified result |
| --- | --- | --- |
| `npx tsc --noEmit` (root + `server/`) | types | 0 errors (Fase 5.5) |
| `npm run build` (root) | single-file production build + `dist/index.html.gz` (+ `dist/fonts/`, favicons, manifest) | 657.57 kB raw / 159.34 kB gzip, plus 14 font subsets (582 kB, only the used subsets are downloaded) — Fase 5.5 |
| `cd server && npm run test:all` | audit (32), uploads (30), production readiness (**163**, incl. TLS/HSTS, proxy trust, boot guards, readiness, public payload, delete confirmation, magic bytes, admin posture, list-projection, gzip/304 of the SPA fallback, robots/sitemap/404s/headers/API-JSON compression/font caching, **release identity + `LOG_LEVEL`**, **the official brand/icon set + manifest tokens (Fase 6.0)**), env hardening (13), **`ops` script regression (21, §7m)**, youtube (+ Data API fallback), **auth (69)** | Fase 6.0, with published content in the database: audit 32, uploads 30, production **163**, env 13, ops **21**, youtube 14+ cases, auth 69 — **all green, exit 0** (**328 ✅**). Needs content: on a reference-only database the production suite reports **158/163** (§ *Test-data condition*) |
| `ops/backup.sh` + `ops/restore-drill.sh` | database + uploads backup, then a restore into a throwaway database with count and checksum comparison | PASSED in Fase 5.1 (seven tables + two upload files, §7g) and again in Fase 5.6, that time **from an off-site copy** made by `ops/offsite-copy.sh` (25/8/11 rows and 50+50 joins matching the manifest, §7l) |
| `ops/healthcheck.sh` · `ops/alert.sh` · `ops/deploy-check.sh` | watchdog (health, readiness, **the release the API reports**, backup freshness, disk, database), alert delivery to a webhook/mail, and an eleven-check post-deploy/rollback proof | Fase 5.6.1: watchdog `result: OK (8 checks)` on a healthy host, **0 bytes** on a healthy `--quiet` run and exit 1 with its FAIL lines + release on stderr on a failing one; the 21-check `ops` regression in the server suite covers the payload escaping, the release line, `--quiet`, the unit's exit codes and the manifest guard (§7m); deploy check **11 passed, 0 failed** against the production build (§7l) |
| `cd server && npm run test:imports` | live Archive.org + YouTube import regression | 19/19 whenever the provider answers; the live scrape check is the part that fails under Google's throttle (§8.11) |
| `npm run test:e2e:brand` | all eight SVGs: file/HTTP identity, pure-path structure, official colours, transparency and 100/400/1000% renders; real BrandLogo component, header/footer on six routes at 1366/375/320px, signed-out admin, retained favicon metadata | **222/222 (Fase 6.1)** on a static production preview; no API/database or fake fixtures. `SITE_URL` defaults to `http://localhost:4173`; optional `BRAND_EVIDENCE_DIR`, otherwise outputs go outside the checkout to a temporary directory |
| `npm run test:e2e:production` | routes, embeds, **real YouTube playback**, error states, mobile, admin entry (login gate), footer navigation (17 checks), **accessible names for the search fields (9, Fase 5.6.1)** and **the official brand assets incl. deep links and mobile (33, Fase 6.0)** | Fase 6.0: **135/135** against the production build with 25 published records. Needs published content — a YouTube video, an `RenewingOurIntentions` audio record, an Archive book, a scholar and a subject — and stops at the first missing fixture on an empty library. YouTube throttling can turn the two live-playback checks red (§8.11) |
| `npm run test:e2e` | waveform, thumbnails, admin upload flow | 27/27 in Fase 5.6; **21/27** in Fase 5.6.1 — all six red checks read the live archive.org stream (playback position, waveform frames/heights), and archive.org itself answered 302 → **500** on the file and **502** on `/metadata` from this sandbox at that moment: external availability (§8.14), not the site |
| `npm run test:e2e:cms` | admin CMS: real totals, draft→published→archived→restored, collection round-trip, 401 honesty, **typed delete confirmation + `CONFIRM_REQUIRED`**, **brand assets in the signed-in CMS (5, Fase 6.0)** | **39/39** (Fase 6.0; was 34) |
| `npm run test:e2e:auth` | Fase 4.5 gate: username/password sign-in, 401s, cookie flags, deep link, refresh, tampered cookie, server-side logout, no credential in web storage, public site stays free | 60/60, re-run 60/0 in Fase 5.6.1 |

The database-dependent browser specs take `SITE_URL`, `API_URL`, `ADMIN_TOKEN` (for their API fixtures) and sign the
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

**Test-data condition (Fase 5.6.1).** Two suites need *published content* in the target database and do
not create it themselves, so a green run says as much about the data as about the code:

- `cd server && npm run test:all` → the production suite reports **158/163** on a database that only has
  the reference seed: the same five checks as before (2 need a published record, 3 compare gzip on a
  response that stays below the 1 kB threshold while the library is empty). With content present it is
  **163/163**.
- `npm run test:e2e:production` → its fixtures are real records (a YouTube video, an
  `RenewingOurIntentions` Archive audio item, an Archive book, a scholar, a subject); on an empty library
  it stops at the first missing fixture.

Populate the database before judging a red suite: import a handful of records through the admin
importers, or run `cd server && npm run test:imports` once (that suite deliberately leaves one record
behind).

**State of these numbers (Fase 5.4):** the numbers above were measured in the same rebuilt sandbox
(PostgreSQL 17.11). For Fase 5.4 the public path was measured on a purpose-built scale database
(`ilmnet_perf`: 20 000 contents, 48 scholars, ~30 000 scholar links, ~38 000 subject links) next to
the 25 real Archive.org/YouTube records in `ilmnet`/`ilmnet_prod`; the measurement scripts and the
exact numbers are in §7j. Anything measured there was left in place only when the repository could
confirm it; nothing was optimised without a number.

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

## 7j. What Fase 5.4 (performance & scale) changed — and what it measured

Fase 5.4 started with measurement, not with code. A `ilmnet_perf` database was built to the same shape
as production (20 000 contents — 20 % drafts, 80 % in 50 collections of 400 items, 48 scholars,
29 883 scholar links, 37 751 subject links, archive-like `metadata` of ~800 B per record, descriptions
of ~490 B) and the public endpoints were measured against it with a plain HTTP harness, `EXPLAIN
(ANALYZE)`, `pg_stat_statements` and Chromium (including a throttled 3G profile). Everything below is
that measurement; only the three bottlenecks that showed up were changed.

### Measured before (20 000 records, one request at a time)

| Endpoint | p50 | p95 | Response |
| --- | --- | --- | --- |
| `GET /api/contents?limit=100&type=lecture,video,audio` | 59 ms | 78 ms | 363 kB |
| `GET /api/contents?limit=100&q=patience` (free text) | 175–490 ms | 218–548 ms | 363 kB |
| series page: `GET /api/contents?limit=100&q=<collectionIdentifier>` | 282–596 ms | 348–640 ms | 362 kB |
| `GET /api/scholars/:slug` (scholar with ~600 linked records) | 76 ms | 89 ms | **1414 kB** |
| `GET /api/scholars` / `/api/subjects` | 3 ms / 2 ms | 5 ms / 2 ms | 15 kB / 3 kB |
| single-file `index.html` on a 3G profile (1,6 Mbps) | DCL 3272 ms | — | **631 kB uncompressed** |

Under 25 concurrent requests the same series path reached a p50 of **4,3 s** (p95 8,3 s) on this
2-CPU sandbox, and the free-text search 2,5 s (p95 5,0 s) — the two paths that scan the table per
request.

`EXPLAIN (ANALYZE)` showed where the time goes: with `ORDER BY "updatedAt" DESC LIMIT 100` the planner
cannot stop early, so every request evaluated a nine-branch `ILIKE` OR (including two correlated
`EXISTS` over the join tables) across all 20 000 rows — twice, because the endpoint also asks for
`pagination.total` in parallel. `pg_stat_statements` confirmed it: the two `SELECT … FROM contents`
shapes and their `COUNT(*)` twins were the top four statements by total time (387–575 ms mean each).

### The three changes

1. **Series pages use the index instead of a table scan.** The public detail/series pages searched
   their collection as free text (`q=<collectionIdentifier>`) and filtered client-side, because the
   API had no exact filter. `GET /api/contents` now accepts `collection=<identifier>` (equality on the
   indexed `collectionIdentifier` column, `server/src/lib/validation.ts` + `routes/content.ts`), and
   `SeriesDetail.tsx` and the "more from this collection" block in `ContentDetail.tsx` use it.
   *Measured:* **596 ms → 26 ms** (p50, same server, same data, 23×); under 25-way concurrency
   **4 274 ms → 280 ms** (p95 8 324 → 451 ms). It also fixes a real correctness wart: `q=Pool3` used to
   match `Pool30…Pool39` and could fill the 100-item page with other collections.
2. **A list response no longer ships what a card cannot render.** `publicContentList` (in the Fase 5.3
   positive-list module) keeps the same top-level keys but reduces `metadata` to the provider media
   keys (`src/lib/thumbnail.ts` is the only public reader) and reduces the nested scholar/subject rows
   to the card shape. *Measured:* list item 3 543 B → ~2 360 B, response **363 kB → 236 kB (−35 %)**,
   scholar detail **1 414 kB → 1 011 kB (−29 %)**. The detail endpoints still return the full public
   shape, and Fase 5.3's exact-key test keeps guarding the contract (only the nested data changed).
3. **The bundle is delivered compressed.** `scripts/precompress.mjs` (new, `node:zlib`, no dependency)
   writes `dist/index.html.gz` as part of `npm run build`, and both static registrations use
   `preCompressed: true`; the SPA fallback now goes through `reply.sendFile` (async, ETag/Last-Modified,
   `304` for repeat visitors) instead of a synchronous `readFileSync` of 646 kB per deep link.
   *Measured on a Fast 3G profile (1,6 Mbps, 150 ms RTT), same server, `.gz` removed vs present:*
   **wire 631 kB → 157 kB, DCL 3 272 ms → 952 ms (−71 %)**, whole page 889 kB → 415 kB.

### What was measured and deliberately **not** changed

- **Free-text search (0,18–0,49 s at 20 000 rows).** Every result is honest (`pagination.total` is a
  real count, per the Fase 3.9 rule) and the query is deliberately broad: nine columns plus scholar and
  subject names. The only real fix is an index — `CREATE EXTENSION pg_trgm` plus GIN trigram indexes on
  the searched columns — which is a database change, so it is documented as a host-side scaling step
  with the exact SQL (`docs/DEPLOYMENT.md` §5e) instead of being applied here. At the current library
  size (25 records) the same query takes 2–4 ms; §8.16 keeps it on the list.
- **Lists stop at 100 items** (client-side pagination, `pagination.total` already exists). Server-side
  paging is an API + UI change; §8.2 stays open with the same wording as before.
- **API JSON is not compressed in-app.** Fastify has no built-in compression and a new dependency was
  not allowed, so gzip for `/api` is a reverse-proxy setting (exact nginx lines in
  `docs/DEPLOYMENT.md` §5c). On the same 3G profile a 236 kB list response would drop to ~40 kB there.
- **The Prisma connection pool** (default `2 × CPU + 1`, here 5) was not re-tuned: the measured
  latency under 25-way concurrency is dominated by the queries that the three changes above removed,
  not by waiting for a connection. Pool sizing stays a deployment decision (`connection_limit` in
  `DATABASE_URL`, §8.18).
- **Image loading was already correct**: the only `<img>` in the app (`MediaThumb`) is `loading="lazy"`
  by default with a single `eager` opt-in on the detail hero; no change was needed.

### Verified after (same harness, same database)

| Endpoint | p50 before → after |
| --- | --- |
| series page (`collection=`) | 596 ms → **26 ms** |
| series page under 25-way concurrency | 4 274 ms → **280 ms** (p95 8 324 → 451 ms) |
| public list (100 items) | 363 kB → **236 kB** |
| scholar detail | 1 414 kB → **1 011 kB** |
| `index.html` on 3G | 631 kB / DCL 3 272 ms → **157 kB / DCL 952 ms** |
| free-text search (unchanged path) | 0,18–0,49 s (documented, not fixed) |

`npx tsc --noEmit` clean in `./` and `./server`; `npm run build` exit 0 (645.96 kB, and
`dist/index.html.gz` 156.96 kB); server suites audit 32, uploads 30, production **112**, env 13 and auth
69 green (256 checks; the youtube suite stops at its live watch-page check because this sandbox's
YouTube access is throttled, §8.11); e2e production 82/84 (only the two live-playback checks fail, and
a bare YouTube embed outside the app fails identically in this sandbox), admin-auth 60/60, cms 34/34,
media 27/27.

**Not changed on purpose:** no new dependency, no schema change, no redesign, no pagination rewrite.
The measurement scripts (`/tmp/perfapi54.mjs`, `/tmp/perfseries54.mjs`, `perf-browser.tmp.mjs`,
`perf-fixture.tmp.mjs`) were run from the sandbox and are not part of the repository.

## 7k. What Fase 5.5 (production polish) changed — and what was deliberately left alone

Instruction: read `AGENTS.md` and this file, check `git status`, then audit the existing production code on
the polish points (SEO/metadata, accessibility and keyboard use, titles/descriptions/Open Graph, 404 and
error pages, loading/error/empty states, favicon/manifest, privacy and security headers, external fonts and
resources, API JSON compression/documentation, the pagination cap, mobile UX, stale copy and docs, real data
on public pages). Functional changes are **not** part of it: no redesign, no new visual language, no new
dependency, no schema change, no TinyCMS.

### Measured before (production build on :3101, real database, Playwright)

| Finding | Evidence |
| --- | --- |
| One static title/description for **every** route; no Open Graph, canonical or robots meta; nothing in `src/` ever touched `document.title` | 13 routes inspected: identical `<title>` "ilmNet — A quiet library for Islamic knowledge", `og:title` absent |
| `/favicon.ico`, `/favicon.svg`, `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest` answered **HTTP 200 `text/html`** | the SPA fallback served `index.html` for any unknown path; `public/` did not exist |
| Google Fonts on every page load | `fonts.googleapis.com` (stylesheet) + `fonts.gstatic.com` (4 woff2 files): visitor IP to a third party, two extra DNS/TLS round trips |
| 4 Dutch sentences in the English public UI | `AudioPlayer.tsx` (3×), `Lectures.tsx` (1×) |
| No skip link; the first tab stop was the nav | tab-order probe on `/` |
| Headers: `nosniff`, `referrer-policy`, `x-permitted-cross-domain-policies` present; `permissions-policy`, CSP, HSTS (app-level) absent | response headers of `/` |
| `path="*"` → **Landing**: a mistyped URL looked like a working home page | `src/App.tsx` + probe of `/dit-bestaat-niet` |
| One item, two addresses (`/lectures/<book-slug>` and `/books/<book-slug>` both render) | `ContentDetail` accepted either route; no canonical link existed to resolve it |

The audit note "the lists have no empty state" turned out to be **wrong**: `Lectures`, `Books`, `Scholars`,
`Subjects`, `ContentDetail`, `SeriesDetail` and `SubjectDetail` all had loading, error and empty states
(`EmptyState` in `src/components/ui.tsx`). What was real: the empty text for a *filtered* list ("try another
search term") was also shown when the library itself was empty. That was fixed instead of adding states.

### Changed

1. **Self-hosted fonts (no third-party request at all).** `public/fonts/` holds 14 `.woff2` files — Inter
   400/500/600 and Plus Jakarta Sans 500/600/700/800, latin + latin-ext — plus the SIL OFL licence files.
   The `@font-face` rules with their original `unicode-range` values live at the top of `src/index.css`;
   `index.html` no longer preconnects to or loads Google. A page downloads only the subsets it renders
   (5–10 files, 47–83 kB each). Consequence: a visitor's IP never reaches Google before pressing play,
   which removes the consent question for the fonts and two extra round trips on first load.
2. **`robots.txt` and `sitemap.xml` are now real responses** (`server/src/routes/seo.ts`). Both are built
   server-side from **published rows only**, with the canonical origin from `PUBLIC_ORIGIN` (falling back to
   the request host only when it is unset). The sitemap lists the app's own routes — `/`, `/lectures`,
   `/books`, `/scholars`, `/subjects`, `/series/<collection>`, `/subjects/<slug>` and
   `/lectures|books/<slug>` — with `<lastmod>` where a row exists, is cached for an hour per origin, and is
   gzipped on request (9 111 → 1 240 bytes on the fixture database). It respects the sitemap.org limits
   (45 000 content URLs, newest first). `robots.txt` disallows `/admin` and `/api/`.
3. **Per-route metadata** (`src/lib/usePageMeta.ts`, called by every public page and by the admin gate):
   title, description, canonical, `og:title/description/type/url/site_name` and the Twitter equivalents.
   The canonical is origin + pathname, so `/lectures?subject=tawheed` stays `/lectures`. `og:image` is only
   emitted when a real thumbnail exists (see "deliberately not" below). A not-found detail page is
   `noindex`, a transient "Loading…" state never sets a title, and the admin is `noindex, nofollow`.
4. **A real 404 page** (`src/pages/NotFound.tsx`, route `path="*"`): same header/surface vocabulary as the
   existing "content not found" state, `noindex`, the mistyped path shown, and links to the four sections.
5. **Skip link + result announcements** (`src/components/Layout.tsx`): "Skip to content" is the first tab
   stop, becomes a rose pill on focus (verified: hidden 1 px → visible, 146 px) and moves focus to
   `<main id="main-content" tabIndex={-1}>` without navigating. The filter result lines on `/lectures` and
   `/books` are `role="status" aria-live="polite"`.
6. **Honest empty states and English-only copy.** A filtered list still says "No lectures/books match"; an
   empty library says "No lectures/books yet" and no longer offers a "Clear all filters" button for filters
   nobody set (mirrors the pattern `Scholars` already had). The four Dutch strings are English now; the scan
   for Dutch text in the public UI returns zero.
7. **Canonical address per item.** `ContentDetail` redirects (replace) to the section that owns the type —
   books/documents under `/books`, everything else under `/lectures` — and sets the canonical link
   accordingly, so one item no longer has two addresses for a crawler.
8. **Security headers the app can honestly set** (`server.ts`): `permissions-policy` switching off what
   ilmNet never uses (camera, geolocation, microphone, payment, usb, midi, serial, hid, bluetooth,
   publickey-credentials-get), and a **report-only** `content-security-policy-report-only` that describes the
   real dependencies (self-hosted fonts, `frame-src` for YouTube/Archive/Google Books). Features the embeds
   are delegated (`accelerometer`, `gyroscope`, `fullscreen`) are deliberately **not** denied: a
   Permissions-Policy denial cannot be re-delegated to a child frame.
9. **Build fix: asset URLs are root-absolute again.** `vite-plugin-singlefile` forces `base: "./"`. With
   BrowserRouter and deep links that resolves `url(./fonts/…)` and `href="./favicon.svg"` against the
   *current route*: on `/lectures/<slug>` the browser asked for `/lectures/fonts/…` and `/lectures/favicon.svg`
   — measured as 4 failed font requests and a favicon that only worked on `/`. `vite.config.ts` now passes the
   plugin's documented `overrideConfig: { base: '/' }`.
10. **A missing file is a 404.** The SPA fallback still answers unknown *pages* with the app shell (the
    client renders its own 404), but a path that looks like a file (`/does-not-exist.png`, `/robots-missing.txt`,
    `/fonts/does-not-exist.woff2`) now returns a JSON 404 instead of `index.html` with status 200. Slugs never
    contain a dot (`toSlug` uses `slugify` with `strict`), so no real page is affected.

### Deliberately not changed (with the reason)

- **No enforcing CSP.** The single-file build inlines the whole app as an inline `<script>`, so a policy that
  actually works would need `script-src 'unsafe-inline'` — a header that promises more than it delivers.
  Report-only keeps the intended policy visible and one deployment away. Enforcing it needs a build change
  (external, hashed bundles), which is a performance and architecture decision, not a polish step.
- **No `X-Frame-Options` / `frame-ancestors`.** ilmNet is meant to be embeddable (link previews, the
  development preview pane) and embeds third parties itself; who may frame the site is a host/proxy decision.
- **No iframe `sandbox` on the embeds.** It would break the real playback paths this project already verified
  (YouTube player, Archive.org player, Web Audio reading the stream). The embed URLs are derived from
  provider identifiers stored by an authenticated operator, not from visitor input. Left as a documented
  trade-off rather than a rushed "hardening".
- **No privacy/contact page.** The technical part of audit I5 is done (self-hosted fonts; no third-party
  request before you press play). The page itself needs the operator's identity, address and legal review,
  none of which the repository contains — and inventing them would be exactly the fake content this project
  forbids. Checklist for that page is in the Fase 5.5 report.
- **No default social card — now for a measured reason.** `og:image` appears only where a real thumbnail
  exists. Fase 6.0 added the missing asset (`brand/ilmnet-og-1200x630.png`), but that export has its payoff
  line clipped by the 1200×630 crop, so publishing it would put a visibly broken card on every share. It
  is deliberately **not** wired up (§7n); a clean re-export switches it on in one line.
- **The 100-item list cap and the counters** (§8.2, measured in Fase 5.4) and **the free-text search**
  (§8.16) stay as they are — measured items, not polish.

### Verified after

`npx tsc --noEmit` (root and `server/`) clean; `npm run build` → 657.57 kB raw / 159.34 kB gzip and the
pre-compressed variant; the production suite **141 checks** (was 112; +29 for robots/sitemap/404s/headers);
the other server suites 32 / 30 / 13 / 69; e2e `production` 82 (+2 environmental YouTube-playback checks),
`cms` 34, `media` 27, `admin-auth` 60 — all green. Browser probes on the built app: fonts load from our own
origin on every route with zero failed requests, titles/canonical/robots correct per route, canonical
redirect works in both directions, skip link focuses `<main>`, `/favicon.ico|svg`, `/apple-touch-icon.png`,
`/manifest.webmanifest` and both PNG icons answer 200 with the right content type on nested routes too.

### Host-only (not solvable from this repository)

- HSTS at the proxy for the real hostname (the app sends it over HTTPS; `max-age` and `includeSubDomains` are
  a host decision — `docs/DEPLOYMENT.md` §5).
- `frame-ancestors`/CSP promotion and any WAF/rate-limit rules (`docs/DEPLOYMENT.md` §5f).
- Serving the sitemap on the *published* domain: it uses `PUBLIC_ORIGIN`, so that variable must be set to the
  real `https://…` origin in production (a wrong value produces a sitemap pointing at the wrong host —
  visible in `/sitemap.xml` within a second).
- Submitting the sitemap to Google/Bing Search Console; nothing in the repo can do that.
- An operator identity/contact address for the privacy page.

### Fase 5.5 — the two remaining delivery items (measured on the same 20 000-record database)

The Fase 5.5 audit re-read the public path and found two things worth changing. Both are measured, not
guessed:

| | Before | After | Evidence |
| --- | --- | --- | --- |
| API JSON was sent uncompressed — the biggest download of a list page | `/api/contents?limit=100` 239 150 B, `/api/scholars` 15 495 B, `/api/subjects` 3 233 B on the wire | 31 566 B (13,2 %), 2 626 B (16,9 %), 1 057 B (32,7 %) | `curl -H 'accept-encoding: gzip'` against the same server and the same content. Implemented with `node:zlib` in an `onSend` hook (no dependency: text-like payloads only, above 1 kB only, only when gzip was requested, never when a content-encoding is already set, never for streams) |
| Files next to `index.html` (fonts, icons, manifest) were revalidated on **every** navigation | 5–6 conditional requests per repeat page view (Playwright on a detail page: 5 × 304 on the second load) | 0 revalidations within a week (`cache-control: public, max-age=604800` for everything but `index.html`, which stays `max-age=0` so a deploy is visible immediately) | `setHeaders` in the `@fastify/static` registration. The `.gz` variant of `index.html` is matched too — a test caught that the compressed entry point would otherwise have been cached for a week |

Browser check on the same library over a throttled 3G profile (1,6 Mbps / 150 ms), `/lectures`: API bytes
per page load **260 939 → 36 299 B (−86,1 %)** and DCL/load **3 324 → 962 ms** with everything compressed
(bundle from 5.4 + API from 5.5); the same run with `accept-encoding: identity` — no compression at all —
is the 3 324 ms figure. Deep links keep going through the static handler, so the frontend needed no change.


## 7l. What Fase 5.6 (operations & monitoring) changed — and what only a host can do

Instruction: read `AGENTS.md` and this file, check `git status`, audit the remaining operational points
(backup timer/retention, off-site copies, restore drill, uptime monitoring, logging and error detection,
deploy/rollback, database and disk monitoring, alerts, the health endpoints, and whether
`docs/DEPLOYMENT.md` covers the operational steps), then **implement only what can be committed safely**
and document the rest without pretending it ran. No new dependencies, no schema changes, no redesign.

### Audited: what was already there

- `ops/backup.sh` (dump + uploads + manifest with row counts and sha256, `RETENTION_DAYS`, a dump that
  `pg_restore --list` accepts), `ops/systemd/ilmnet-backup.{service,timer}` (nightly 02:30,
  `Persistent=true`), `ops/restore.sh` (explicit target, `--recreate` requires `--yes`) and
  `ops/restore-drill.sh` (restores into a throwaway database and compares counts + checksums).
- `GET /api/health` (deep: database + upload storage, 503 when either is unusable) and `GET /api/ready`
  (cheap, database only), both public, both exempt from the `FORCE_HTTPS` redirect.
- Troubleshooting: `docs/DEPLOYMENT.md` §7 (40+ symptom→cause rows).

### Audited: what was genuinely missing

| Gap | Evidence |
| --- | --- |
| **Nothing noticed a backup that stopped happening.** The timer could be off for a month and every check would still say the deployment is fine | `ops/backup.sh` reports its own run; there was no freshness check anywhere, and nothing in the repo referred to a backup alert |
| **No alert path at all** | `grep -rn "alert\|monitoring\|uptime" docs/DEPLOYMENT.md` → 0 hits; a failing backup or a dead API only wrote to a log nobody reads |
| **Off-site copies were one sentence** ("copy it afterwards with rsync/object storage of your choice") with no procedure, no verification and no way to prove a copy is complete | `docs/DEPLOYMENT.md` §6b before this phase |
| **No disk or database monitoring** | `df`/`pg_database_size` appeared nowhere; a nearly-full disk is what makes Postgres and the backup fail at the worst moment |
| **Logging had no guidance**: no rotation, no retention, no level override, no "what to grep" | no hits for `journald`/`logrotate`/`LOG_LEVEL` in any document |
| **A deploy could not be verified.** `/api/health` reported `version: '1.0.0'` as a hard-coded string, and nothing reported *which commit* was live | `server/src/routes/health.ts` before this phase |
| **No post-deploy/rollback step** beyond "restart and look at it" | `docs/DEPLOYMENT.md` §6 |
| **No database/storage numbers in an alert** | same as the alert gap |

### Changed (all of it runnable from the repository)

1. **`ops/healthcheck.sh` — the watchdog.** Checks the deep health endpoint and readiness, uploads
   writability (with a write probe), **backup freshness** (`BACKUP_MAX_AGE_HOURS`, default 30), free disk
   space (`DISK_WARN_PERCENT`/`DISK_CRIT_PERCENT`, default 85/95) and optionally the database
   (`SELECT 1` + size). Exit 0/1, `--quiet` for timers, `--strict`, `--base`. It alerts on failure —
   and only on failure — and it says so explicitly when no channel is configured. What this paragraph
   used to claim about the release and about `--quiet` was wrong; §7m records what was actually
   measured and fixed.
2. **`ops/alert.sh` — delivery that cannot break the caller.** JSON POST to `ALERT_WEBHOOK_URL` (Slack,
   Discord, Mattermost, ntfy, Healthchecks.io, Uptime Kuma, a relay) and/or `mail` to `ALERT_MAIL_TO`,
   always a copy on stderr, credentials/tokens redacted out of the message, `--dry-run` to test the route
   without starting an incident, exit 0 even when delivery fails (with the problem on stderr).
3. **`ops/offsite-copy.sh` — leaving the host, verifiably.** rsync to another host or mount (`cp`
   fallback for a local target), then **size + sha256 against the manifest**; refuses a target inside
   `BACKUP_DIR` or the checkout and warns when the target is on the same device; `--latest`, `--delete`,
   `--dry-run`; prints the drill/restore commands for the copy it just made.
4. **`ops/deploy-check.sh` — post-deploy and post-rollback proof.** Eleven checks in one command:
   readiness, deep health **with the release it reports**, the app shell, a deep link, `robots.txt`,
   `sitemap.xml` (single origin), favicon, `/admin`, a missing file must be 404, and gzip on `/`, plus
   `--expect-commit <sha>` to prove the release that answers is the release you shipped.
5. **Release identity in the API.** `server/src/lib/release.ts`: `version` from `server/package.json`
   (no more hard-coded string), `commit` from `GIT_COMMIT` (unset → `null`, never a guess) and `uptime`.
   `/api/health` reports them and the boot log prints `Release: 1.0.0 (a1b2c3d) · log level: info`.
6. **`LOG_LEVEL`** (`fatal|error|warn|info|debug|trace|silent`). An unknown value is refused with a
   warning and the default is kept: a typo must not silently change what an operator believes is logged.
7. **systemd/ops files**: `ilmnet-healthcheck.{service,timer}` (every 5 min), `healthcheck.env.example`,
   `ilmnet-alert@.service` (the `OnFailure=` target, also added to the backup unit) and
   `logrotate/ilmnet` for file-based logs.
8. **Documentation**: `docs/DEPLOYMENT.md` gained §9 (*Monitoring, logging en alarmering*: watchdog,
   alert channels, external uptime checks + dead-man's switch, logging/rotation/`LOG_LEVEL`/what to grep,
   database- and disk monitoring, and **§9f: the host-only checklist**), an off-site + retention section
   in §6b, release verification and honest rollback caveats in §6, `GIT_COMMIT`/`LOG_LEVEL` in §1, seven
   new symptom rows in §7, and the new fields in §8. `ops/README.md`, `README.md` and `AGENTS.md` follow.

### Verified in this sandbox (real runs, real database)

| Step | Result |
| --- | --- |
| `ops/backup.sh` against the `ilmnet` database | 37 484-byte dump, 62 restorable objects, manifest written, uploads archived |
| `ops/offsite-copy.sh --latest` to a target directory | rsync path **and** the `cp` fallback both verified size + sha256 against the manifest |
| `ops/restore-drill.sh --dump <off-site copy>` | **PASSED** — restored from the *copy*: 25 contents, 8 scholars, 11 subjects, 50 + 50 join rows, 3 import jobs, all matching the manifest; the throwaway database was dropped afterwards |
| `ops/healthcheck.sh` (healthy host) | `result: OK (7 checks)` — health, ready, uploads writable, backup 0 h old, two filesystems (23 %/27 %), database `SELECT 1` (size 8 598 kB) |
| `ops/healthcheck.sh` (API dead / no backup set) | exit 1 with `FAIL health … HTTP 000` and `FAIL no backup set found … the timer has never run or writes elsewhere` |
| Alert delivery | a local webhook receiver got both `critical` POSTs, with host, service, severity, timestamp and the failing lines |
| `ops/alert.sh --dry-run` / without a channel | shows the exact payload; without a channel it exits 2 and says the stderr copy is the only one |
| `ops/deploy-check.sh --expect-commit <sha>` against the production build | **11 passed, 0 failed, 0 warnings** |
| Server suite | production readiness **154/154** (was 147; +7 for release identity and `LOG_LEVEL`), audit, uploads 30, env 13, auth 69 — all green |
| `tsc --noEmit` (root + server), `npm run build` | clean; 657,57 kB / 159,34 kB gzip |
| e2e `production` (re-run) | 82 ✅ / 2 ✗ — the two live YouTube-playback checks, environmental (§8.11) |

Three real bugs were found by running the new scripts rather than by reading them: a `| head -1` after
`grep` turned into exit 141 under `set -o pipefail` (fixed with `-m1`/`awk`), `grep -v` exiting 1 inside a
command substitution killed the script through errexit (fixed with `|| true`), and
`${DISK_PATHS:-"$A $B"}` expanded to a single word so the disk checks silently did nothing (fixed by
building an array). All three are listed because they are exactly the kind of thing that makes a
monitoring script useless without anyone noticing.

### Host-only — documented, deliberately not claimed as done

1. Install the timers/units and fill `/etc/ilmnet/{backup,healthcheck}.env` (systemd or cron).
2. Choose and test an alert channel (`ALERT_WEBHOOK_URL`/`ALERT_MAIL_TO`) — the script is verified, the
   operator's webhook is not.
3. Create the external uptime check (and the dead-man's-switch ping) — `docs/DEPLOYMENT.md` §9c.
4. Set `GIT_COMMIT` in the service environment so deploys/rollbacks are verifiable.
5. Fill `BACKUP_DIR`/`OFFSITE_TARGET` for the real environment, wait for the first nightly run, then run
   the drill **from the off-site copy**.
6. Set journald/Docker log limits or install the logrotate config (§9d).
7. Postgres' own health (`pg_stat_activity`, `max_connections`) stays a host/monitor decision: the
   watchdog reports the database size and connectivity, not a full database-monitoring stack (§9e).

That is the whole remaining operational surface: nothing in it is a code change, and every item has a
command or a table in `docs/DEPLOYMENT.md` §9.

## 7m. What Fase 5.6.1 (audit fixes) changed — the Fase 5.1–5.6 end-audit, closed

Instruction: read `AGENTS.md`, this file and the end-audit report, fix **only** the defects the read-only
end-audit had reproduced, add regression tests for them, correct the documentation claims that were
wrong, and report which audit points deliberately stay open. No new dependencies, no schema change, no
redesign, no TinyCMS.

### Fixed (each with the test that pins it)

| # | Reproduced in the audit | Now | Regression test |
| --- | --- | --- | --- |
| **P1** | `ops/restore-drill.sh` printed *"drill PASSED — … with matching counts"* and exited 0 while **nothing** was compared: without `BACKUP_DIR` it looked for the manifest in the wrong place, printed "no manifest entry" for all seven tables and skipped every comparison — an off-site set was unverified but green | The manifest is looked up **next to the dump** first (that is how an off-site copy arrives), then in `BACKUP_DIR`; without a manifest the drill refuses to run (exit 1); comparisons are counted and printed, and **0 comparisons is exit 3**. Measured on the same set: the old script → `PASSED`, exit 0; the new script → `drill FAILED — … not one value could be compared`, exit 3; with the manifest beside the dump → `8 comparison(s) … matched`, exit 0 | `server/test/ops.test.ts` (guards + exit codes) and the before/after run above |
| **P2** | `ops/alert.sh` escaped only the body: `--subject` with a `"` produced invalid JSON at the receiver (`PARSE-ERROR … position 78`) while the script exited 0 | One shared builder (`json_payload`) escapes **every** value for both `--dry-run` and the real POST — backslash, quote, newline, tab, CR, backspace, form feed — and the credential/token redaction is unchanged | `ops.test.ts`: a local receiver parses a POST whose subject contains `"`, the subject round-trips, a tab in the body is escaped, a URL password is still `***` |
| **P3** | The watchdog deleted the `/api/health` body before reading it, so the release (`version (commit)`) could never reach the log or the alert — that check simply never fired | `check_http` hands the body back through `printf -v`; the log shows `OK release reported by /api/health: 1.0.0 (0011ac6)` and the alert body gains `release: …` | `ops.test.ts`: a stub API proves the log line, and a stub whose `/api/ready` answers 503 proves the release reaches the failing `--quiet` output |
| **P15** | A failing run with `--quiet` (exactly what the systemd unit starts) wrote **0 bytes** and exited 1, and `SuccessExitStatus=0 1 2` counted a missing tool as success — a fault could stay invisible without an alert channel | `--quiet` still silences a healthy run, but a failing one always writes its FAIL lines, the release and the summary to stderr (a WARN alone stays quiet; `--strict` prints it too); the unit accepts exit 0/1 only, so exit 2/3 fail the unit and fire `OnFailure` | `ops.test.ts`: healthy `--quiet` = 0 bytes/exit 0; failing `--quiet` = exit 1 with `FAIL …`, `result: FAIL` and the "no alert channel" hint on stderr; the unit file is asserted to contain `SuccessExitStatus=0 1` |
| **P16** | `SearchBar` rendered `<input placeholder="…">` with no label, `aria-label` or `aria-labelledby` (measured on `/lectures`, `/books`, `/scholars`): screen readers announced an unnamed edit field | The component always sets an `aria-label` (an explicit `label` prop, otherwise the placeholder), the three public and four admin call sites pass a short real label ("Search lectures", …), and the decorative magnifier icon is `aria-hidden` | `tests/e2e/production.spec.mjs` section 8 (9 checks): every input has an accessible name and the search field is named by `aria-label`, not by its placeholder |
| **P5** | `docs/DEPLOYMENT.md` §9a and `healthcheck.env.example` claimed the watchdog *verifies HSTS over https*; no such check exists | Both say what the watchdog really checks and how to verify HSTS (`curl -sI … \| grep -i strict-transport-security`, or `ops/deploy-check.sh` over https) | `ops.test.ts` asserts the env example no longer claims it and shows the curl command |
| **P6/P7/P17** | Stale self-correction in §7l, `Last updated: Fase 5.4`, "69 source files, ~15.6k lines" (measured 77 files / 17 158 lines) and "a list keeps `archive.*`" (the code keeps three specific keys) | Corrected in §1, §3, §6 and §7l with re-measured numbers | — (documentation) |
| **P12** | Nothing documented that the production suite and the production e2e suite need published content; a fresh database silently reported 149/154 | §6 has a *Test-data condition* paragraph, with the numbers and how to populate a database; `README.md` and `AGENTS.md` repeat it next to the commands | — (documentation) |

### Verified after the fixes (Fase 5.6.1)

| Step | Result |
| --- | --- |
| `npx tsc --noEmit` (root + `server/`) | 0 errors |
| `npm run build` | `dist/index.html` 657 806 B (657.81 kB); pre-compressed `dist/index.html.gz` 163 210 B (159.38 kB) |
| `cd server && npm run test:all` (database with 25 published records) | audit 32, uploads 30/0, production **154/0**, env 13/0, **ops 21/0** (new), youtube 14+ cases, auth 69/0 — **exit 0** |
| `npm run test:e2e:production` | **93/93** (84 + 9 new accessibility checks) |
| `npm run test:e2e:auth` · `test:e2e:cms` | 60/60 · 34/34 |
| `npm run test:e2e` (media) | 21/27 — the six red checks read the live archive.org stream, and archive.org itself answered 302 → **500** on the file and **502** on `/metadata` from this sandbox at that moment (§8.14) |
| Real drill on an off-site layout (dump + manifest together, no `BACKUP_DIR`) | `8 comparison(s) … matched`, exit 0; the same set without a manifest → exit 3 |
| Watchdog against the production build | `result: OK (8 checks)` incl. the release line; healthy `--quiet` = silent; failing `--quiet` = exit 1 with FAIL lines + release on stderr |

### Deliberately left alone (still open after this phase)

- **P4** — `ops/systemd/ilmnet-alert@.service` still has `$(hostname)` in its `ExecStart` subject (systemd does not expand it; the alert text carries the host anyway). It is outside the instructed fix list.
- **P8** — the 53 MB `opencode-*.tar.gz` blob stays in the Git history (removing it needs a rewrite); **P9** the dead exports in `ui.tsx`/`thumbnail.ts`/`api.ts` and `src/admin/data.ts`; **P10** `docs/backend-architecture.md` is still a pre-implementation design dossier while `AGENTS.md` calls it the API reference; **P11/P13** the README status line and the ops usage blocks.
- Not re-opened: the 100-item list cap, the `ILIKE` search (measured, with the pg_trgm recipe in §5e), the non-enforcing CSP, `frame-ancestors` and the `__Host-` cookie prefix.

## 7n. What Fase 6.0 (brand implementation) changed — and what was deliberately not used

Instruction: implement the delivered brand package (`brand/`, see `ASSET_MANIFEST.txt`) in the existing app
**without redesigning it**, using only assets that are technically fit for production, without inventing
missing brand assets, and keeping every existing test green.

### Decisions carried out

- **Colour truth = `brand/brand-tokens.json` + `brand-tokens.css`.** `#A2AB73` and `#CC3A63` were already
  `--color-olive`/`--color-rose`; `--color-brand-bg #f3ebdd`, `--color-surface #ffffff` and
  `--color-charcoal #1f2933` were added to the Tailwind `@theme`, and `theme-color`/`theme_color` now use
  the official `#F3EBDD` (was `#f6f1e7`/`#fff7eb`). The cream/sand surfaces and `--color-ink` were **not**
  recoloured — that would be a redesign.
- **Official name `IlmNet`**, `Net` in clay pink — exactly what the delivered wordmark shows; the
  code-drawn wordmark (which coloured `Net` olive) is gone.
- **Official assets only.** `src/components/Brand.tsx` renders the supplied files through one `BrandLogo`
  component (`<picture>`: WebP → PNG, real `width`/`height`, aspect ratio on the wrapper so a height *or*
  a width class both work). Usage follows the package: **primary** in the header (40 px = the 120 px
  minimum; 36 px = 108 px on mobile) and footer (32 px = 96 px), **stacked** on the admin sign-in screen
  (128 px), **small-scale** in the admin sidebar (44 px = 82 px), **icon-only** in compact chrome and the
  admin gate. No variant was drawn, recoloured or re-proportioned.
- **Icon set = the delivered favicon files**: 16/32/48/64 PNG in `index.html`, `apple-touch-icon.png`, and in
  `manifest.webmanifest` the 48/192/512 PNG with the official `#F3EBDD` background/theme colour. The
  self-made `favicon.svg`, `favicon.ico`, `icon-192.png` and `icon-512.png` were removed: the package ships
  **no** SVG master and **no** `.ico`, and inventing either was explicitly out of scope. `ops/deploy-check.sh`,
  `docs/DEPLOYMENT.md` and the production suite now check `/brand/favicon/favicon-32.png` instead of
  `/favicon.ico`.
- **Real bug found and fixed while verifying:** with the size class on the `<img>` inside a `<picture>`, the
  browser ignored the height (the shrink-to-fit parent set the intrinsic width) and rendered the logo 450 px
  wide at 40 px tall — stretched. The aspect ratio now sits on the wrapper, and a Playwright assertion
  guards the rendered width (~120 px, never the intrinsic 450 px) plus the mobile height.

### Implemented, in exact files

| Asset(s) | Where |
| --- | --- |
| `logo/ilmnet-logo-primary-light.{webp,png}` | `Nav.tsx` (header 36/40 px), `SiteFooter.tsx` (32 px) |
| `logo/ilmnet-logo-stacked.{webp,png}` | `AdminLogin.tsx` (128 px — the package's centered placement) |
| `logo/ilmnet-logo-small-scale.{webp,png}` | `AdminLayout.tsx` sidebar (44 px = 82 px wide) |
| `logo/ilmnet-logo-icon-only.{webp,png}` | `AdminLayout.tsx` mobile top bar, `AdminGate.tsx` loading screen |
| `favicon/favicon-{16,32,48,64}.png`, `apple-touch-icon.png`, `android-chrome-{192,512}.png` | `index.html`, `public/manifest.webmanifest` |
| `brand-tokens.*` | `src/index.css` (`@theme`), `index.html` (`theme-color`), `manifest.webmanifest` (`theme_color`, `background_color`) |

### Deliberately NOT used (with the reason)

| Asset / variant | Why not |
| --- | --- |
| `og/ilmnet-og-1200x630.png` | The payoff line under the logo is **clipped by the 1200×630 crop** (only the tops of the letters remain). Publishing it would put a broken-looking card on every share, so `og:image` still falls back to per-page thumbnails. One clean re-export switches it on in one line. |
| `logo/ilmnet-logo-horizontal.*` | 1.86:1 — it needs 43 px of height for the package's 80 px minimum and 65 px for the 120 px desktop minimum, which does not fit the existing 40 px header. The primary variant is 3:1 and reaches 120 px at exactly 40 px, so the header uses that. |
| `logo/ilmnet-logo-primary-dark.*`, `monochrome-dark`, `monochrome-light` | The UI has no dark or single-colour surface; the package lists them for exactly that case. |
| `icon/ilmnet-icon.{webp,png}` (1024 px) | No spot needs a photo-sized icon — the app icons are the delivered favicon set, as the package prescribes. |
| `social/ilmnet-profile-1080.png` | There is no social profile in this repository. |
| `FINAL_APPROVED_LOGO_SYSTEM_REFERENCE.png`, `ASSET_MANIFEST.txt`, `BRAND_IMPLEMENTATION.md` | Reference only; the manifest and the markdown stay in `brand/` as the source of truth. |
| A `.svg` master, a `.ico`, any redraw or "cleaned" export | Not delivered, and inventing brand assets was explicitly out of scope. The package's own note says a true vector master has not been supplied. |

**Known imperfection of a delivered file (used as delivered):** `ilmnet-logo-primary-light.png` carries a
faint remnant of the payoff line in its bottom 1–2 pixel rows, visible only at ≥4× magnification (the WebP
differs from the PNG on <0.1 % of pixels; `small-scale` is the cleanest file but is below the package's
120 px minimum at header height). It is used unchanged — editing a supplied brand asset would violate "do
not alter proportions, colors, spacing".

### Verified after the change

| Step | Result |
| --- | --- |
| `tsc --noEmit` (root + `server/`) | 0 errors |
| `npm run build` | 657 837 B raw / 163 527 B pre-compressed; `dist/brand/` carries the official files |
| `cd server && npm run test:all` (25 published records) | audit 32 · uploads 30/0 · production **163/0** (+9 brand/icon-manifest checks) · env 13/0 · ops 21/0 · youtube ✅ · auth 69/0 — exit 0 |
| `npm run test:e2e:production` | **135/135** (+33 brand) — header 120×40 desktop / 108×36 mobile, footer 96×32, deep links, admin, no overflow |
| `npm run test:e2e:cms` | **39/39** (+5) — the signed-in sidebar shows the small-scale logo at 82×44 with WebP |
| `npm run test:e2e:auth` · `npm run test:e2e` (media) | 60/0 · **27/27** (the archive.org stream answered this time) |
| `ops/deploy-check.sh` on the production build | **10 passed, 0 failed**, including `/brand/favicon/favicon-32.png → 200 (image/png)` (11 with HSTS over https) |

## 7o. What Fase 6.1 (true SVG logos) changed — and the reconstruction limits

**Source and scope.** Started from a clean `master == origin/master == ae1c746`; no newer upstream
commit was present on the final pre-commit fetch. The supplied logo PNGs are opaque RGB presentation
crops with backgrounds, texture, card borders and occasional clipped neighbouring content. They
contain no original vector master or source font. `brand/SVG_RECONSTRUCTION.md` records all roles,
artboards, reconstruction decisions, visual checks and repeatable commands.

### Implemented

- Eight standalone SVGs in `public/brand/logo/`: **primary-light, primary-dark, horizontal, stacked,
  small-scale, icon-only, monochrome-dark, monochrome-light** (98 962 B together). Every visible
  element is a filled vector path: book/leaf symbol, outlined IlmNet wordmark and, where present in
  the source variant, **ISLAMIC KNOWLEDGE LIBRARY**. No image payload, font, text element, background
  plane, gradient, shadow or external resource. Monochrome really is one colour.
- Official foreground colours are exactly `#1F2933`, `#CC3A63`, `#A2AB73` and `#FFFFFF` per variant.
  `#F3EBDD` stays a host-surface colour, never a logo background. The original reference artboards
  and variant-specific geometry are retained; the opaque presentation surfaces/crop debris are gone.
- `src/components/Brand.tsx` selects `.svg` directly, without raster fallback. Existing placement,
  aspect-ratio reservation and accessible names are unchanged: header 120×40 desktop / 108×36
  mobile, footer 96×32; admin sign-in stacked at 128px width, sidebar small-scale, compact icon-only.
  All eight variants are selectable. No other application component, API, database, login/session
  logic or auth behaviour was edited. Favicons/app icons, original PNG/WebP files and lockfiles are
  unchanged. No project dependency added; missing Playwright OS runtime libraries were installed
  in the sandbox only after explicit user permission.
- Production/CMS browser assertions now expect the actually selected SVG. The new
  `tests/e2e/brand.spec.mjs` / `npm run test:e2e:brand` is a read-only, database-independent brand
  regression. It uses the actual production CSS for isolated BrandLogo rendering, not a fake auth
  context. Browser evidence is written outside the checkout.

### Visual review and honest limits

All eight variants were opened as real browser-rendered SVG artwork at **100%, 400% and 1000%**
and inspected alongside their PNG references. Transparent negative space was checked on light/dark
checkerboards; desktop/mobile header and footer plus the real signed-out admin page were inspected.
The pure-path/palette checks and alpha measurements also reject opaque artboards, crop-edge debris,
font dependencies and embedded raster content. An offline review HTML provides the eight source
comparisons, zoom/background controls and real integration captures; it is a delivery artifact,
not another logo implementation in the app.

**All eight variants exist, but exact original typography cannot be certified.** Symbol/wordmark
curves were reconstructed from the contours, not typeset in an assumed font. For the small descriptor,
blind tracing broke thin diagonals at 1000%; explicit clean letter outlines from the largest readable
reference replaced those artefacts, preserving measured spacing and each smaller placement. The
4–6px source letters do not reveal exact original font outlines. The longer presentation payoff
“Knowledge. Guidance. A Brighter Tomorrow.” is clipped in primary-light and absent from the other
logo files; it was not invented as an extra logo line. No missing/unreliable detail is presented as a
recovered original master. SVG also cannot make a physically 2–3px-high descriptor readable without
changing the established layout, which this task deliberately does not do.

### Fresh verification (26 September 2026)

| Check | Result |
| --- | --- |
| Root + server `npx tsc --noEmit` | both exit 0 |
| `npm run build` | exit 0; `index.html` **658 219 B**, gzip **163 620 B** |
| Syntax of brand / production / CMS browser specs | all exit 0 |
| `npm run test:e2e:brand` | **222/222**; 8 variants × 3 zooms, six public routes × 3 viewports, isolated shared-component variants, real signed-out page, asset/palette/alpha and metadata checks |
| Visual inspection | all eight at 100/400/1000%; no background blocks; header/footer on desktop/mobile, no stretching/overflow |
| Offline review artifact | 8 panels, all zoom controls and background switch work; 0 external requests, 0 script errors, 0 mobile horizontal overflow |

This is **not a new full-stack test run**: the static preview had no running API/database; no records,
accounts, counters or authenticated CMS state were fabricated. Full production/CMS/auth/media and
server runtime suites were not rerun. Fase 6.0's totals in §7n remain historical. Node 20.20.2 /
npm 10.8.2 were used; the existing `content-disposition@3.0.0` server dependency advertises Node >=22
and gave an `npm ci` engine warning. No dependency was upgraded to hide that warning.

A test-harness issue was corrected before the green run: replacing a mounted home page with
`setContent` left its WebGL loop alive and stalled a second page. Isolated component checks now use
a fresh blank document with the actual build CSS and asset base. No website code changed for that
harness correction.

### Git delivery checkpoint

At the validation/documentation checkpoint there was still no configured credential helper, SSH
agent/key or GitHub token environment variable, despite the user choosing to arrange safe access.
**Push and remote equality are not yet confirmed.** This checkpoint ships in the locally verified
SVG phase commit. Do not reuse or reproduce a chat-shared token. Once safe authentication is configured,
push `master`, fetch
and compare the full `HEAD` / `origin/master` IDs and confirm a clean working tree. Refresh this
checkpoint with the actual outcome; never claim `local == origin/master` from an old fetch.

## 8. Known remaining issues (not blockers)

From `docs/FASE3_9_CODEBASE_REVIEW.md` § Restrisico's plus the 3.9.1 report:

1. **Single-file bundle** — the CMS ships inside the same `index.html` as the public site; code
   splitting is impossible while `vite-plugin-singlefile` is active.
2. **100-item lists** — public lists and the admin store fetch up to 100 items per request; growth
   needs server-side pagination / infinite scroll (`pagination.total` already exists, and the admin
   now reports the real total next to the loaded page). Fase 5.4 measured the per-item cost and cut it
   by 35 % (§7j) but deliberately left the cap itself alone.
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
11. **YouTube throttles datacenter IPs.** Google may answer the watch page with `302 →
    google.com/sorry` (observed in the Fase 4.5 session after many live requests), which fails the live
    checks in `server/test/youtube.test.ts` and `test:imports`. Fase 5.4 saw the *same* restriction hit
    playback as well: in that sandbox the two live playback checks of `tests/e2e/production.spec.mjs`
    fail (`player state -1`, 0 `videoplayback` requests), and a **bare YouTube embed loaded from a
    plain HTML page — outside this application — fails identically**, which is how the suite's failure
    was attributed to the network rather than to the site. Embeds, `oEmbed` and the embed URL itself
    (`HTTP 200`, 133 kB) keep working. Setting `YOUTUBE_API_KEY` (Fase 4.3) or retrying from an
    unrestricted network removes the scraping dependency; the checks pass again when YouTube answers
    the watch page normally.
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
    dangerous combinations, a readiness probe, no published database/API port in compose), and Fase 5.6
    did the same for operations (watchdog, alerting, off-site copy, deploy check, release identity — all
    scripts, timers and unit files are in the repo, §7l). What is left is genuinely environmental and
    enumerated in **`docs/DEPLOYMENT.md` §9f**: installing the timers/units and filling the env files,
    choosing + testing an alert channel, creating the external uptime check and dead-man's-switch ping,
    setting `GIT_COMMIT`, filling `BACKUP_DIR`/`OFFSITE_TARGET` and drilling from the first off-site
    copy, and setting log limits. Plus, unchanged from before: terminating TLS and renewing certificates;
    forwarding `X-Forwarded-Proto` and choosing the real `TRUST_PROXY` value; rate limiting in front of
    the public API; and a resource/pool budget for the real traffic (audit I2, I9, L13). §5b/§5c/§6b/§9
    hold the exact commands, log lines and `curl` checks that prove each one.

15. **The session cookie is not `__Host-`-prefixed** (Fase 5.3 reviewed and left this). The cookie is
    already `HttpOnly`, `Secure` and `SameSite=Lax`, and it is set with `Path=/` on the host itself —
    so it is not exploitable by a sibling subdomain today. Moving to `__Host-ilmnet_session` is a
    cheap extra layer but changes the cookie name (an existing session would have to sign in once
    more) and needs one place to keep the `Max-Age`/expiry contract; do it together with any other
    cookie change.

16. **Free-text search is the remaining table scan** (Fase 5.4 measured it: 0,18–0,49 s at 20 000
    records, 2,5 s p50 under 25-way concurrency; unchanged since the series path was fixed). The fix is
    `CREATE EXTENSION pg_trgm` plus GIN trigram indexes on the searched columns — a database change,
    written out with the measured numbers in `docs/DEPLOYMENT.md` §5e and §7j. At the current library
    size it is 2–4 ms, so it is a *when the library grows* step, not an open bug.
17. **API JSON compression was added in Fase 5.5** — a 100-item list on the 20 000-record database
    goes out as 31 566 B instead of 239 150 B (13,2 %), and a list page over 3G drops from 260 939 B to
    36 299 B of API data (§7j). It is done in the app with `node:zlib`, so it works without proxy
    configuration; a proxy may still gzip the rest (uploaded images are already compressed and are left
    alone by both). `docs/DEPLOYMENT.md` §5c keeps the nginx lines for deployments that prefer to do it
    at the edge.
18. **The Prisma connection pool** is at its default (`2 × CPU + 1`, 5 in this sandbox; Prisma logs
    `connection_limit` guidance when it is tight). Fase 5.4 measured a 25-way concurrency burst and
    found the latency came from the queries it fixed, not from pool waiting, so nothing was changed —
    for a multi-instance deployment size the pool per instance against Postgres' own `max_connections`
    (`connection_limit` in `DATABASE_URL`).


19. **The API log is the only place a 5xx is visible by default.** Fase 5.6 added `LOG_LEVEL`, the
    watchdog and alerting, so a *host-level* failure page goes out — but there is still no error tracker
    (Sentry/GlitchTip) and no per-endpoint metric. Decide when the site has real traffic: either add an
    external error tracker in the frontend/API, or keep §9d's `grep` habits and watch `/api/health`.
    Deliberately not solved with a dependency now.
20. **A privacy/contact page is still missing** (audit I5, partially closed in Fase 5.5). What the
    repository can fix is done: the fonts are self-hosted, so a visitor's browser talks to no third party
    until they open a page with an embedded player, and the embedded YouTube player is the only
    third-party load (it also loads its own fonts inside its frame). The page itself needs the operator's
    identity, a contact address and a legal review — none of which belong in a code change. Content
    checklist: what is logged (IP, user agent, timestamps) and why; that there is no visitor account and
    no analytics; that the admin session cookie exists only for signed-in operators; which third parties
    are contacted when a player is opened (YouTube, Archive.org, Google Books) and under which terms;
    how to request removal of a link. Linked from the footer once it exists.
21. **An enforcing Content-Security-Policy needs a build change.** Fase 5.5 ships a report-only policy
    that matches the real dependencies. Enforcing it would require `script-src 'unsafe-inline'` because
    the single-file build inlines the app as an inline `<script>`; a real policy needs external, hashed
    bundles (which also re-opens the code-splitting question Fase 3.9 measured as pointless). One
    deliberate step, not a header flip.
22. **`frame-ancestors`/`X-Frame-Options` and the CSP promotion belong to the host** (`docs/DEPLOYMENT.md`
    §5f). The app deliberately sends no framing rule: ilmNet is embeddable and embeds third parties
    itself; a preview pane or a link-preview card would break.

## 9. Next step

**Immediate next step: finish Fase 6.1 Git delivery once safe authentication is configured** (§7o),
then verify a clean working tree and fresh `HEAD == origin/master`. The SVG implementation, build,
both typechecks and 222 focused branding checks passed; this is not a fresh claim that every
full-stack suite is green. Earlier backend/CMS/provider results below remain historical.

The account/session model from Fase 4.5 (§7f), the provider investigation (§7e) and the cleanup/login
phases (§7c–§7d) remain as documented; this branding phase changes none of them.

**The roadmap is production finishing, UI/UX and performance toward the definitive live deployment.**
Fase 5.1 removed the three blockers that were verifiable in the repository; the rest starts on the host.

- **Phase 5.3 — data safety (done, §7i).** The legacy token now needs `ADMIN_LEGACY_TOKEN=true` in
  production (and its absence without an account stops the boot), public payloads are positive lists,
  hard deletes must name their record, uploads are validated by magic bytes, and the health payload no
  longer publishes the upload path.
- **Phase 5.4 — scale and speed (done, §7j).** Measured on a 20 000-record database: the series filter
  is index-backed (596 → 26 ms), list responses are 35 % smaller, and the single-file bundle is
  pre-compressed (631 → 157 kB, DCL 3 272 → 952 ms on 3G). Deliberately left as measured items:
  server-side pagination past 100 items (§8.2), the trigram index for free-text search (§8.16) and
  gzip for API JSON at the proxy (§8.17).
- **Phase 5.6 — operations & monitoring (done, §7l).** The watchdog, alert delivery, off-site copies
  with manifest verification, the post-deploy/rollback smoke test, release identity in `/api/health` and
  `LOG_LEVEL` are in the repository and were run here (backup → off-site copy → drill from the copy;
  watchdog healthy and failing; alerts delivered to a real webhook receiver). `docs/DEPLOYMENT.md` §9
  holds the procedures and §9f the exact host-only list: install the timers, fill the env files, choose
  and test an alert channel, create the external uptime check, set `GIT_COMMIT`, drill from the first
  off-site copy, set log limits.
- **Phase 6.1 — true SVG logos (locally verified, §7o).** Eight transparent, path-only reconstructions
  replace raster logo requests in the existing header/footer/admin placements. All variants reviewed
  at 100/400/1000%; 222/222 scoped branding checks. Original font/tiny descriptor fidelity limits are
  explicit. Backend/auth/database, favicon assets and dependencies unchanged. Push awaits safe access.
- **Phase 6.0 — brand implementation (historical baseline, §7n; logos superseded by 6.1).** The package
  introduced official logo assets in header/footer/admin (then WebP with PNG fallback), the official icon set as favicon, app
  icons and manifest icons, the official `#F3EBDD` as browser/manifest theme colour and the official tokens
  in `@theme`. The code-drawn mark/wordmark and the self-made favicon files are gone. Deliberately unused:
  the clipped OG export, the horizontal (too wide for the 40 px header), the dark/monochrome variants (no
  dark surface), the 1024 px icon, the profile image, and any SVG/.ico that the package does not contain.
- **Phase 5.6.1 — audit fixes (done, §7m).** The Fase 5.1–5.6 end-audit reproduced four operational
  defects (a drill that could pass without comparing anything, an alert whose JSON broke on a quote in
  the subject, a watchdog that could never report the release, and a failing `--quiet` run that left an
  empty log) and one accessibility defect (the public search fields had no accessible name). All five
  are fixed and covered by regression tests (`server/test/ops.test.ts`, e2e section 8); the wrong
  HSTS/watchdog claim and the test-data condition are corrected in the docs.
- **Phase 5.5 — polish and compliance (done, §7k + §7j).** Self-hosted fonts (audit I5, the technical
  half), `robots.txt`/`sitemap.xml`/favicon/manifest/Open Graph (L9), per-route titles and descriptions,
  a real 404 page, a skip link, English-only public copy, honest empty states, the security headers the
  app can set, and API JSON compression with per-file caching on top of Fase 5.4. Left to the host or the
  owner, with the reason in §7k: an enforcing CSP (needs external bundles), `frame-ancestors`, and the
  privacy/contact page (needs the operator's identity — the checklist is now §8.19).

**The remaining production-host checklist (carried forward, not re-audited by the SVG task):**
deploy on the real host (TLS, `PUBLIC_ORIGIN`, proxy trust — §8.14), install the operational timers and channels
(`docs/DEPLOYMENT.md` §9f), submit the sitemap once DNS is live. After that the open choices are
priorities, not gaps: CI + staging (audit I9, §8.9), account UI/roles/2FA, and the measured scale items
(§8.16 trigram search, §8.2 pagination) when the library actually grows. A first production deploy now
has a checklist for every step, including the two that only a human can do: choosing an alert channel
and restoring from an off-site copy once.

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
