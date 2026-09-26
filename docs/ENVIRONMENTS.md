# ilmNet — Environments and the release flow

**Status:** binding rule. Project-wide, applies to every phase from now on.
**Related:** `AGENTS.md` §0/§2 (working agreement), `docs/DEPLOYMENT.md` (host runbook),
`docs/RELEASES.md` (the promotion record per release), `server/.env.example` (configuration shape).

---

## 1. The rule

ilmNet runs in exactly **three** environments:

| # | Environment | Purpose |
| --- | --- | --- |
| 1 | **development** | Building and local testing. |
| 2 | **staging** | Production-like environment where the *complete* release is tested. Same configuration structure, security, build and deployment approach as production. |
| 3 | **production** | Only a release that has first passed staging successfully. |

Non-negotiables:

1. Development configuration never reaches staging or production automatically.
2. No development defaults in production.
3. Production never depends on a local `.env` file.
4. Environment-specific values are supplied explicitly by that deployment/environment.
5. Security and production guards are already active in staging.
6. Never test a "development build" and then promote loose code to production.
7. A release is built **once** and validated in staging before the *same* release goes to production.
8. No production-only fixes: the same change travels development → staging → production.
9. Every phase checks which environment is active.
10. Tests state explicitly which environment/configuration they run against.
11. Every release documents what moves from development to staging and then to production.

A feature is **done** only when it works locally *and* has been validated in staging with
production-like configuration.

---

## 2. Environment matrix

| | development | staging | production |
| --- | --- | --- | --- |
| `NODE_ENV` | `development` | **`production`** | `production` |
| `ENVIRONMENT` | unset or `development` | **`staging`** (explicit) | **`production`** (explicit) |
| Config source | `server/.env` **or** process env | process environment only | process environment only |
| Build | Vite dev server | the built release (`npm run build`), served by the API | the same built release |
| Guards | relaxed (local convenience) | full production guards (token strength, CORS allowlist, no `.env`, boot guards, admin-access check) | full production guards |
| Crawling | irrelevant | **disabled** (`robots.txt` `Disallow: /`, `x-robots-tag: noindex, nofollow`, empty sitemap) | enabled (`Allow: /`, sitemap with published URLs) |
| Database | local, demo seed allowed | its **own** database, real reference data + imported content; the destructive demo seed is refused | production database; `seed:reference` only |
| Uploads | `server/uploads` | its own persistent volume (`UPLOADS_DIR`) | production volume |
| Admin accounts | local convenience + legacy token | own accounts (`npm run admin:create`) | own accounts |
| Data policy | anything | a realistic copy/import; never a copy of production secrets | real visitor data |

There is deliberately **no** `NODE_ENV=staging`: staging is `NODE_ENV=production` with
`ENVIRONMENT=staging`, so it inherits every production guard by construction instead of by promise.

---

## 3. How the code enforces it

`server/src/lib/env.ts` is the single place that decides the environment. It refuses to guess:

| Rule | Behaviour |
| --- | --- |
| **E0** | An unknown `ENVIRONMENT` value (e.g. `stagin`) refuses the boot: a process that cannot name its environment must never pick guard rails by accident. |
| **E1** | `ENVIRONMENT=staging\|production` requires `NODE_ENV=production`. A development-configured process may never carry a staging/production identity. |
| **E1b** | `NODE_ENV=production` with `ENVIRONMENT=development` is a contradiction and is refused. |
| **E2** | `ENVIRONMENT` may not come from a `.env` file (it is a guard key, rule R3): the identity of a deployment comes from the deployment. |
| **R2** | A process that carries deployment configuration (`DATABASE_URL`, `ENVIRONMENT`, `ADMIN_TOKEN`, `CORS_ORIGIN`, `UPLOADS_DIR`) must declare `NODE_ENV` explicitly — no silent fallback to development. |
| **R3** | In production mode a `.env` file may not supply `NODE_ENV`, `ENVIRONMENT`, `ADMIN_TOKEN`, `CORS_ORIGIN` or `ADMIN_ALLOW_LOCALHOST`. |
| **R4** | `ADMIN_TOKEN` must be production-grade (≥16 chars, no known/placeholder value) — also in staging. |
| **Derived identity** | Only `NODE_ENV=production` set, no `ENVIRONMENT`: the identity resolves to `production` (backwards compatible) and the boot log **warns** to set it explicitly. Staging is never derived. |

Visibility (so a deploy can be *proved*, not assumed):

- `GET /api/health` reports `environment` (`development|staging|production`) and
  `environmentSource` (`process|file|derived`) next to the existing `version`/`commit`.
- `GET /api/ready` stays deliberately minimal (`status`, `service`, `database`, `timestamp`): a
  load-balancer probe must not pay for diagnostics, and the production suite pins that shape. The
  identity is therefore asserted on the deep endpoint, in the boot log and in
  `ops/deploy-check.sh --expect-environment`.
- The boot log prints `Environment: <name> · NODE_ENV=<mode> (<source>)`, warns on a derived identity,
  and warns explicitly when it is serving staging.
- `ops/deploy-check.sh --expect-environment <name>` asserts the environment that answers, and on
  staging additionally asserts the non-indexable posture (`robots.txt` `Disallow: /`, `x-robots-tag`).
- `ops/healthcheck.sh` reports the environment in its log, in its `--quiet` failure output and in the
  alert body, so an incident says which environment it is about.
- Every test suite prints an environment banner (environment, `NODE_ENV`, identity source, config
  file, database target **without credentials**, API target) before it runs.

---

## 4. Staging: how it is built and deployed

Staging uses the **same approach** as production — same artifact, same configuration shape, same
guards — with different values:

1. **Own origin with TLS**, e.g. `https://staging.ilmnet.example`, terminated at the reverse proxy
   (`docs/DEPLOYMENT.md` §5b). The admin session cookie is `Secure`, so staging needs HTTPS too.
2. **Own database** (e.g. `ilmnet_staging`) and **own uploads volume** (`UPLOADS_DIR`).
3. **Configuration from the process environment only** (systemd `EnvironmentFile` or compose
   `environment:`), with `ENVIRONMENT=staging`, `NODE_ENV=production`, a strong `ADMIN_TOKEN`,
   an exact `CORS_ORIGIN` for the staging origin, `PUBLIC_ORIGIN=https://staging.ilmnet.example`,
   `TRUST_PROXY` for the proxy, and `GIT_COMMIT=<the deployed commit>`.
4. **Own operator account**: `npm run admin:create -- --username … --password '…'` (never a production
   account, never a shared password).
5. **Data**: `npm run seed:reference` plus content imported through the CMS importers (or a
   *sanitised* copy of production content). The destructive demo seed (`npm run seed`) is refused on a
   staging-configured host by the existing production-safety check.
6. **The same build artifact** as production: `npm run build` is run **once** in the release step and
   that output is deployed everywhere. Staging is never built from a different commit than the one
   that will be promoted.

Suggested systemd shape (mirrors the production unit, different paths and env file):

```ini
# /etc/systemd/system/ilmnet-staging.service
[Service]
EnvironmentFile=/etc/ilmnet/staging.env          # ENVIRONMENT=staging NODE_ENV=production …
ExecStart=/usr/bin/node /srv/ilmnet-staging/server/dist/server.js
```

`/etc/ilmnet/staging.env` (values, not shape, differ per environment):

```
ENVIRONMENT=staging
NODE_ENV=production
DATABASE_URL=postgresql://…/ilmnet_staging?schema=public
UPLOADS_DIR=/var/lib/ilmnet-staging/uploads
PUBLIC_ORIGIN=https://staging.ilmnet.example
CORS_ORIGIN=https://staging.ilmnet.example
TRUST_PROXY=127.0.0.1
ADMIN_TOKEN=<openssl rand -hex 32>
GIT_COMMIT=<commit being deployed>
```

---

## 5. Release flow (the only path to production)

```
Development
  → tests
  → build            (once — this artifact is the release)
  → commit
  → push
  → Staging deployment
  → full staging checks
  → Production release (the same artifact)
  → production smoke checks
```

**1 · Development — implement and test locally**

```bash
npx tsc --noEmit && (cd server && npx tsc --noEmit)
cd server && npm run test:all            # each suite prints its environment banner
cd server && npm run test:environment    # the environment rule itself
npm run build                            # dist/index.html + dist/index.html.gz
npm run test:e2e                         # media/player, if the change can touch it
```

**2 · Commit and push** — one commit per coherent change, message `Fase <n> <description>` (or a plain
imperative subject for chores). Push to `origin/master`; staging deploys from that commit, never from
a dirty worktree.

**3 · Deploy to staging** — deploy the artifact from step 1 to the staging host (systemd restart or
`docker compose up -d --build`, see `docs/DEPLOYMENT.md` §2/§3), with `GIT_COMMIT` set to the commit
being released.

**4 · Full staging checks** — this is the gate:

```bash
# environment identity + guards + staging posture (robots/x-robots-tag)
BASE_URL=https://staging.ilmnet.example \
  ops/deploy-check.sh --expect-commit <sha> --expect-environment staging

# ops sanity on the staging host
BASE_URL=https://staging.ilmnet.example BACKUP_DIR=… UPLOADS_DIR=… ops/healthcheck.sh

# the browser suites, executed against staging (not against a local server)
SITE_URL=https://staging.ilmnet.example API_URL=https://staging.ilmnet.example \
ADMIN_USERNAME=… ADMIN_PASSWORD=… ADMIN_TOKEN=… \
  npm run test:e2e:production && npm run test:e2e:cms && npm run test:e2e:auth && npm run test:e2e:brand

# the API-level suites against the staging database (explicit mode + token)
cd server && NODE_ENV=production ENVIRONMENT=staging ADMIN_TOKEN=… DATABASE_URL=… \
  npm run test:production && npm run test:ops && npm run test:env
```

Every command above prints the environment banner, so the evidence itself says what it was testing.
Record the outcome with numbers in `docs/RELEASES.md` (§6 below).

**5 · Production release** — deploy **the same artifact** (same commit, same `dist/`), with the
production environment values and `GIT_COMMIT` set to that commit. Never rebuild for production and
never move a staging instance into production.

**6 · Production smoke checks**

```bash
ops/deploy-check.sh --base https://ilmnet.example --expect-commit <sha> --expect-environment production
ops/healthcheck.sh …          # watchdog once, by hand
curl -sI https://ilmnet.example/ | grep -i strict-transport-security
# plus a 2-minute manual pass: home, one lecture (plays), one book, one series, one scholar,
# /admin sign-in screen, no draft visible anywhere
```

**Rollback** is a deploy of the previous commit + `ops/deploy-check.sh --expect-commit <old sha>`
(`docs/DEPLOYMENT.md` §6); it is a release action, so it gets its own record.

---

## 6. Promotion record (required per release)

`docs/RELEASES.md` holds one entry per release. An entry is complete only when all of these are filled
in with facts (commands + numbers), never with "should be fine":

| Field | Content |
| --- | --- |
| Release | commit id + one-line description |
| What moves | the changes going development → staging → production (files/features) |
| Development | type checks, build output (bytes), suites and their results |
| Artifact | `dist/index.html` size + hash (`sha256`), so staging/production can be proven identical |
| Staging | deploy time, `deploy-check --expect-environment staging` result, browser suites, API suites |
| Production | deploy time, `deploy-check --expect-environment production` result, smoke result |
| Deviations | anything that was not tested, why, and what the risk is |

---

## 7. Rules that follow from this (and where they bite)

- **A fix found in production** goes back to development, gets its tests, then staging, then
  production — no direct production edits. If that is impossible in an emergency, the hotfix is
  promoted backwards immediately afterwards and the deviation is written in the record.
- **A fix found in staging** is fixed in development and the release cycle restarts from the build.
- **Never** `ENVIRONMENT=staging` on a production host, or the reverse: the boot log and
  `/api/health` make it visible, and `--expect-environment` fails the deploy check.
- **Staging is never indexed.** If a staging host is reachable from the internet, the crawl rules and
  the `x-robots-tag` header are the protection (plus, optionally, proxy authentication).
- **The environment is checked at the start of every phase** (see `AGENTS.md` §0): report
  `NODE_ENV`, `ENVIRONMENT`, where the configuration comes from, and which database/API a run targets.
- **Tests declare their target** — the banner is part of the output of every suite, and it strips
  credentials before printing.

---

## 8. What only the host can do (not solvable in this repository)

1. Create the staging host, DNS name and TLS certificate.
2. Provision the staging database and uploads volume, and fill `/etc/ilmnet/staging.env`.
3. Create the staging operator account.
4. Put the build artifact and the server build on the host (rsync/registry/CI) and restart the service.
5. Set `GIT_COMMIT` in both service environments so a deploy is verifiable.
6. Run the backup/healthcheck timers for staging too (a staging restore drill is worth one run).
7. Decide whether staging is reachable publicly (then the crawl rules protect it) or behind proxy auth
   (better), and never point it at production data.
8. Optional: wire the flow above into CI so steps 3–6 cannot be skipped by accident.

---

## 9. Relation to the existing runbook

`docs/DEPLOYMENT.md` stays the host runbook (environment variables, systemd, Docker, TLS, proxy trust,
backup/restore, monitoring). This document adds the *rule* and the *promotion flow* around it; where
they overlap, `docs/DEPLOYMENT.md` describes the commands and this document says which environment
they may be run against and what evidence must be recorded.
