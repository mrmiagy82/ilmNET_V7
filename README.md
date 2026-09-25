# ilmNet

A structured, free Islamic library on the web: lectures, books, scholars and subjects — organised into
shelves, series and collections instead of an endless feed. No account, no paywall, no tracking.

## What is in it

**Public library** (`/`) — browse lectures, books, scholars and subjects; series and collection pages
group related items; detail pages embed the real source (YouTube player, Archive.org reader/audio,
Google Books preview) with an "open original" link. Audio items use a custom player with a live
waveform. Search and filters live in the URL, so any view can be shared.

**Admin CMS** (`/admin`, behind a username + password login) — guided content wizard, CRUD for lectures, books, scholars
and subjects, custom thumbnail uploads, and bulk import from Archive.org and YouTube (preview →
select → confirm, each item becomes its own record).

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, React Router, Tailwind v4, Vite (single-file build) |
| Backend | Fastify, Prisma, PostgreSQL, zod validation |
| Tests | Playwright (browser e2e), `tsx` suites (API, uploads, env guards, imports) |

```
src/            public site + admin CMS
server/         Fastify API, Prisma schema/migrations, seed scripts, test suites
tests/e2e/      Playwright specs (production + media)
docs/           runbooks, phase reports and architecture notes
```

## Local development

```bash
# 1. database (any PostgreSQL 14+)
createdb ilmnet

# 2. backend
cd server
cp .env.example .env          # development-only config (see the warnings in that file)
npm install
npx prisma migrate deploy
npm run seed:reference        # subjects + scholars — never touches content
npm run dev                   # API on :3001

# 3. frontend (second terminal, repo root)
npm install
npm run dev                   # vite on :5173, proxies /api and /uploads to :3001
```

Admin: create the first operator on the server, then sign in at `/admin`:

```bash
cd server
npm run admin:create -- --username admin --password 'a-long-unique-password'
```

The browser posts the username and password to the API, which checks them with scrypt and answers
with an `HttpOnly; Secure; SameSite=Lax` session cookie — the browser stores no credential at all
(no `localStorage`, no `sessionStorage`, nothing in the bundle), and signing out destroys the session
on the server. Manage accounts with `npm run admin:list`, `admin:password`, `admin:disable` and
`admin:enable`. The public site never needs a login. `ADMIN_TOKEN` still works server-side as a
dual-mode fallback for scripts and CI.

YouTube import: works without any key (it reads the public watch/playlist pages). Set `YOUTUBE_API_KEY`
in the **server** environment to use the official YouTube Data API v3 first — exact durations, publish
dates and whether a video is embeddable — with the public pages as fallback. The key is server-side
only: never in a `VITE_*` variable, the database, the bundle or the repository.

## Tests

```bash
# backend (needs PostgreSQL + server/.env)
cd server
npm run test:all              # audit, uploads, production readiness, env guards, youtube
npm run test:env              # production env/security regression (13 checks)
npm run test:imports          # live Archive.org/YouTube import regression (needs a running server)

# browser end-to-end (needs a running server + built frontend)
npm run test:e2e:production   # routes, deep links, error states, mobile, admin
npm run test:e2e              # player/waveform, thumbnails, admin upload flow
```

## Production

`npm run build` produces the single-file `dist/index.html` **plus** `dist/index.html.gz`; the API serves
the compressed variant whenever the browser accepts gzip (631 kB → 157 kB, measured on a 3G profile).
Next to it, `dist/fonts/` holds the 14 self-hosted font subsets (Inter + Plus Jakarta Sans, latin and
latin-ext, SIL OFL) and `dist/favicon.svg|.ico`, `dist/apple-touch-icon.png`, `dist/icon-192|512.png`
and `dist/manifest.webmanifest` are the icon set. Text responses from the API are gzipped in the app
(`node:zlib`), so a 100-item list on a 20 000-record library goes out as ~31 kB instead of ~239 kB, and
`/robots.txt` + `/sitemap.xml` are generated from the published records on the canonical origin.

Health for orchestrators: `GET /api/health` is the deep check (database **and** upload storage,
503 when either is unusable) and `GET /api/ready` is the cheap readiness probe a load balancer should
use. Deployment hardening — proxy trust, `X-Forwarded-*`, TLS/HSTS, the no-public-port compose setup —
is described in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) §5b/§5c.

Admins sign in with a real account; the shared `ADMIN_TOKEN` is a script/CI fallback that is **off in
production** unless `ADMIN_LEGACY_TOKEN=true` is set (§5d), and a production boot without accounts and
without that opt-in refuses to start. Public API responses only contain presentation fields — internal
attribution (`createdBy`/`updatedBy`/`importJobId`) never leaves the admin endpoints — and deletes that
cannot be undone must name the record they destroy (`?confirm=<id|slug>`, typed in the CMS).

Operational scripts live in [`ops/`](ops/README.md): `backup.sh` (database dump + uploads archive +
manifest), `restore.sh` (explicit target, refuses destructive guesses), `restore-drill.sh` (proves a
backup set restores into a throwaway database), `offsite-copy.sh` (copies the sets off the host and
verifies them against the manifest), `healthcheck.sh` (watchdog for health, backup freshness and disk),
`alert.sh` (webhook/mail alerts) and `deploy-check.sh` (post-deploy smoke test that also proves *which*
release is live). Systemd timers/services and a logrotate example are included; what only the host can
do is listed explicitly in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) §9f.

The full runbook lives in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md): required environment variables,
systemd/pm2 and Docker Compose setups, the production-safe seed (`npm run seed:reference`), health
checks (`/api/health` → 200/503) and rollback.

Performance was measured, not guessed: `docs/CONTEXT.md` §7j holds the numbers for the public path
(20 000-record database — list payload −35 %, the series filter index-backed at 596 → 26 ms, the
pre-compressed bundle) and `docs/DEPLOYMENT.md` §5e the scaling steps that were deliberately left to
the host.

Two rules matter most:

1. **Configuration comes from the process environment**, never from a `.env` file in the app
   directory — the server refuses to boot in production when a `.env` would supply `NODE_ENV`,
   `ADMIN_TOKEN`, `CORS_ORIGIN` or `ADMIN_ALLOW_LOCALHOST` ([details](docs/FASE3_8_1_ENV_SECURITY.md)).
2. **Never run the demo seed on a production database** — use `npm run seed:reference`, which upserts
   subjects and scholars and never deletes content.

## Documentation

`docs/` contains the deployment runbook, the phase reports (Fase 2A → 3.9) and the architecture notes,
including [`docs/FASE3_9_CODEBASE_REVIEW.md`](docs/FASE3_9_CODEBASE_REVIEW.md) — the final
pre-launch review of this codebase.

## Status

Feature-complete for the current phase and verified end-to-end: 154 production-readiness checks
(including TLS/HSTS, proxy trust, payload whitelists and the crawler surface), 30 upload/thumbnail
checks, 13 env-hardening checks, 69 admin-authentication checks, 32 audit checks, 19 import-regression
checks, 84 production e2e checks and 60 admin-auth e2e checks, and the backup/restore drill succeeds
against real data — most recently **from an off-site copy** (Fase 5.6). Known scale limits (single-file
bundle, 100-item client pagination, `ILIKE` search) are listed in the Fase 3.9 review; what still has to
happen on a real host is in `docs/CONTEXT.md` §8.14 and the explicitly host-only checklist in
`docs/DEPLOYMENT.md` §9f.
