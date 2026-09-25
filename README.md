# ilmNet

A structured, free Islamic library on the web: lectures, books, scholars and subjects — organised into
shelves, series and collections instead of an endless feed. No account, no paywall, no tracking.

## What is in it

**Public library** (`/`) — browse lectures, books, scholars and subjects; series and collection pages
group related items; detail pages embed the real source (YouTube player, Archive.org reader/audio,
Google Books preview) with an "open original" link. Audio items use a custom player with a live
waveform. Search and filters live in the URL, so any view can be shared.

**Admin CMS** (`/admin`, token-protected) — guided content wizard, CRUD for lectures, books, scholars
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

Admin: open `/admin` — the login screen asks for the `ADMIN_TOKEN` from `server/.env`; it is verified
against the API and kept in `sessionStorage` for that tab only. The public site never needs a token.

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

The full runbook lives in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md): required environment variables,
systemd/pm2 and Docker Compose setups, the production-safe seed (`npm run seed:reference`), health
checks (`/api/health` → 200/503) and rollback.

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

Feature-complete for the current phase and verified end-to-end: 44 backend readiness checks, 25
upload/thumbnail checks, 13 env-hardening checks, 19 import-regression checks, 61 production e2e
checks and 27 media e2e checks all pass. Known scale limits (single-file bundle, 100-item client
pagination, `ILIKE` search) are listed in the Fase 3.9 review.
