# AGENTS.md — working agreement for AI/OpenCode sessions

This file is the entry point for every automated session on **ilmNet**. Follow it literally.

## 0. Start every session like this

1. **Read `docs/CONTEXT.md` first.** It holds the current status, commit, architecture, security
   rules, known issues and the next step. Do not start work before you have read it.
2. **Then check Git** before you touch code:
   ```bash
   git status -sb          # working tree must be clean, or explain why it is not
   git log --oneline -5    # know where you are
   git fetch origin && git log --oneline origin/master -1
   ```
   A dirty tree or a diverged `origin/master` is a blocker: report it instead of building on it.
3. **Update `docs/CONTEXT.md`** after any of these: a finished phase, a commit, a sanity check, or a
   discovery that changes how the project must be understood. It is the memory between sessions —
   if it is stale, the next session starts misinformed.
4. **After every change**: run the relevant tests → TypeScript/build → commit → push. Never leave a
   pushed commit that does not build, and never leave work uncommitted "for later".

## 1. The project in one paragraph

ilmNet is a free, public, no-login library for Islamic knowledge (lectures, books, scholars,
subjects, grouped into series/collections). Content is not re-hosted: pages embed the real source
(YouTube, Archive.org, Google Books) and link to it. A token-protected admin CMS at `/admin` curates
  everything — guided content wizard, CRUD, thumbnail uploads and bulk import from Archive.org and
  YouTube. There is no CMS framework and no content layer for website texts: the admin talks to the
  Fastify+Prisma API directly, and fixed copy lives in the React components.

- **Frontend**: React 19, React Router 7, Tailwind v4, Vite — built as a **single `index.html`**
  (`vite-plugin-singlefile`), served by the API in the default deployment.
- **Backend**: Fastify 5, Prisma 6, PostgreSQL, zod validation; single generic `contents` table with
  provider/type enums instead of separate lecture/book tables.
- **Tests**: Playwright browser specs (`tests/e2e/*.spec.mjs`) plus `tsx` suites
  (`server/test/*.test.ts`) that hit the real HTTP API and a real database — there are no mocks.

Details: `README.md` (overview), `docs/backend-architecture.md` (API + data model),
`docs/DEPLOYMENT.md` (runbook), `docs/FASE3_9_CODEBASE_REVIEW.md` (latest review + known limits).

## 2. Rules that must not be broken

**Honesty of the interface**
- Never invent numbers, statistics, progress, "now playing" state or content. Public counters come
  from the API (`pagination.total`, real lists), or are not shown at all. When data fails to load,
  show a loading/error/empty state — never a `0` that looks like an empty library.
- No mock/fallback data for real data. A failed provider fetch is an error, never invented items.
- The activity feed in the admin may only log actions the database confirmed.

**No secrets, ever**
- Never commit `.env`, tokens, credentials or connection strings. `.gitignore` already covers
  `.env`, `server/.env`, `server/dist/`, `dist/`, `node_modules`, logs and the opencode tarball.
- `YOUTUBE_API_KEY` (optional) is a **server-side** variable like `ADMIN_TOKEN`: it belongs in the
  process environment of the API, never in a `VITE_*` variable, the database or the repository. The
  importer works without it and falls back to the public YouTube pages.
- Never put an admin token in a `VITE_*` variable: Vite inlines it into the public bundle. In a
  deployed build the operator pastes the token at runtime in Admin → Token (sessionStorage).
- Never print, echo or paste secret values into documents, commits, logs or `docs/CONTEXT.md`.

**Configuration**
- In production all configuration comes from the **process environment**; the server refuses to boot
  when a `.env` file would supply `NODE_ENV`, `ADMIN_TOKEN`, `CORS_ORIGIN` or `ADMIN_ALLOW_LOCALHOST`
  (see `docs/FASE3_8_1_ENV_SECURITY.md`). `ADMIN_TOKEN` must be at least 16 characters.
- `CORS_ORIGIN` lists exact browser origins; a wildcard in production stops the boot.

**Data**
- Never run the destructive demo seed (`npm run seed`) against a production database — it refuses,
  by design. Production reference data comes from `npm run seed:reference` (subjects + scholars only).
- `content_scholars` / `content_subjects` are join tables; orphans are a bug. `provider +
  externalIdentifier` is unique, so imports dedupe instead of duplicating.
- Drafts must never appear on the public site: public endpoints force `status = published`.

**Scope discipline**
- Do only what the task asks: no new features, no redesign, no dependency swaps "while you are in
  there". Keep the neumorphic/spatial look and the cream/olive/rose palette.
- Real-content imports and existing media are not to be replaced by placeholders.

## 3. Commands you will need

```bash
# frontend (repo root)
npm install
npm run dev                      # vite on :5173, proxies /api and /uploads to :3001
npm run build                    # single-file dist/index.html
npx tsc --noEmit                 # type check

# backend
cd server
npm install
npx prisma migrate deploy        # idempotent
npm run seed:reference           # subjects + scholars only (safe on any database)
npm run dev                      # API on :3001
npx tsc --noEmit

# tests
cd server && npm run test:all    # audit, uploads, production readiness, env guards, youtube
cd server && npm run test:imports        # live Archive.org/YouTube import regression
npm run test:e2e:production      # needs a running server + built frontend (SITE_URL/API_URL/ADMIN_TOKEN)
npm run test:e2e                 # media: waveform, thumbnails, admin upload flow
```

Environment overrides used by the browser specs: `SITE_URL`, `API_URL`, `ADMIN_TOKEN`
(`TEST_ADMIN_TOKEN` for the server suite). Suites that create records clean up after themselves —
verify that they did, and never point a mutating suite at a database whose content you must keep.

## 4. Definition of done

- [ ] `npx tsc --noEmit` clean in both `./` and `./server`
- [ ] `npm run build` succeeds
- [ ] the relevant test suites pass (and their output is quoted in the report)
- [ ] `git status` reviewed — no stray files, no secrets, no build output added
- [ ] commit message in the project's style: `Fase <n> <short description>` (or a plain imperative
      subject for chores)
- [ ] pushed to `origin/master`, then confirm `local == remote` and a clean working tree
- [ ] `docs/CONTEXT.md` updated when the phase changed the project state
