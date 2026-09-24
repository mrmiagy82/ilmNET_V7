# ilmNet — Deployment runbook (productie)

Alles wat je nodig hebt om ilmNet op een echte server te zetten. Getest tegen
PostgreSQL 17 + Node 20 in productiemodus (`NODE_ENV=production`), met een verse database,
een persistent uploads-volume en de volledige testset (server-suites + browser-e2e).

- **Bouwstenen:** Fastify API (`server/`) + gebouwde frontend (`dist/`, één bestand) + PostgreSQL.
- **Twee vormen:** (A) één service — de API serveert ook de frontend; (B) gesplitst — frontend apart
  (nginx/CDN), API alleen. Vorm A is de standaard.

---

## 1. Environment variables

| Variabele | Verplicht | Betekenis |
| --- | --- | --- |
| `DATABASE_URL` | ja | Postgres-URL, bv. `postgresql://user:pass@host:5432/ilmnet?schema=public` |
| `NODE_ENV` | ja (prod) | `production` → admin-token verplicht, CORS-wildcard verboden, `secure`-cookies/fallbacks uit |
| `ADMIN_TOKEN` | ja in prod | Uniek geheim, **minimaal 16 tekens** (gebruik `openssl rand -hex 32`). Beschermt alle writes + alle `/api/admin/*`. Bekende dev-/voorbeeldwaarden worden in productie geweigerd |
| `CORS_ORIGIN` | ja | Exacte browser-origin(s) die de API mogen aanroepen, kommagescheiden. `*` is verboden in prod |
| `HOST` / `PORT` | nee | Default `0.0.0.0` / `3001` |
| `UPLOADS_DIR` | sterk aanbevolen | Map voor custom thumbnails/covers — **op een persistent volume** |
| `SERVE_FRONTEND` | nee | `true` (default) laat de API de build uit `FRONTEND_DIR` serveren; `false` = API only |
| `FRONTEND_DIR` | nee | Locatie van de frontend-build; default `<repo>/dist` |
| `ADMIN_ALLOW_LOCALHOST` | nee | Alleen dev: `false` dwingt het token ook op localhost af |
| `SEED_ALLOW_RESET` | nee | Alleen bewust: laat de **destructieve** demo-seed in productie toe |

Frontend-build (root `.env.example`): `VITE_API_URL` leeg laten in vorm A (zelfde origin).
Zet **nooit** `VITE_ADMIN_TOKEN` in een productiebuild — vite inlined elke `VITE_*`-waarde in de
publieke JavaScript-bundle. De beheerder voert het token in via **Admin → Token** (sessionStorage).

### Hoe env-vars gelezen worden (belangrijk)

De server kent de **herkomst** van elke variabele: de procesomgeving (systemd `EnvironmentFile`,
`docker compose environment:`, een PaaS-env-paneel, `docker run --env-file`) is leidend; een
`.env`-bestand in de servermap is er **alleen voor lokaal ontwikkelen**. Bij het starten gelden
deze regels:

1. **Modus** — `NODE_ENV` uit de procesomgeving wint; anders de waarde uit `.env`; anders
   `development`.
2. **Geen stille terugval** — draagt de procesomgeving deploymentconfiguratie (`DATABASE_URL`,
   `ADMIN_TOKEN`, `CORS_ORIGIN` of `UPLOADS_DIR`) maar is `NODE_ENV` daar niet gezet, dan weigert de
   server te starten in plaats van stil naar development te vallen. Zet `NODE_ENV=production`
   (deployment) of expliciet `NODE_ENV=development` (lokale run met eigen database).
3. **Een `.env` mag productie niet configureren** — in productie mogen `NODE_ENV`, `ADMIN_TOKEN`,
   `CORS_ORIGIN` en `ADMIN_ALLOW_LOCALHOST` niet uit een `.env`-bestand komen. Gebeurt dat toch, dan
   stopt de server met een melding die het bestand én de variabelen noemt.
4. **Tokenkwaliteit** — in productie moet `ADMIN_TOKEN` minimaal 16 tekens hebben en mag het geen
   bekende dev-/voorbeeldwaarde zijn (zoals `change-me-dev-only` of het token uit dit project).

> **Zet dus nooit een `.env` in de app-map van een productiehost.** De server leest zo'n bestand
> niet alleen zelf (dotenv), maar ook via de Prisma-client, ongeacht de werkmap. In Docker is dat
> al afgedekt (`server/.dockerignore` houdt `.env` buiten de image); op een host waar je de service
> direct start moet je het bestand verwijderen. Lokale ontwikkeling (`npm run dev`, de testsuites,
> `npm run seed`) blijft gewoon op `server/.env` werken.

---

## 2. Deploy — zonder Docker (systemd/pm2)

```bash
# 1. code + dependencies
git pull
npm ci                 # root (frontend + e2e)
cd server && npm ci    # API

# 2. bouwen
npm run build          # in repo-root  → dist/index.html (single file)
cd server && npx prisma generate && npm run build   # → server/dist/server.js

# 3. database bijwerken (idempotent, nooit destructief)
npx prisma migrate deploy

# 4. referentiedata (alleen nodig bij een verse database; idempotent)
npm run seed:reference     # 11 subjects + 8 scholars, raakt bestaande content nooit

# 5. starten (migreert eerst, dan de server — zelfde volgorde als de container)
npm run deploy             # = prisma migrate deploy && node dist/server.js
```

Draai dit onder een process manager of systemd, met de env-vars uit §1. Voorbeeld:

```ini
# /etc/systemd/system/ilmnet.service
[Service]
WorkingDirectory=/srv/ilmnet/server
EnvironmentFile=/etc/ilmnet/ilmnet.env      # bevat o.a. DATABASE_URL, ADMIN_TOKEN, CORS_ORIGIN
ExecStart=/usr/bin/node dist/server.js
Restart=always
Environment=NODE_ENV=production
```

**Reverse proxy (nginx/Caddy):** stuur het hele domein naar de Node-service; de API doet de
SPA-fallback voor `/lectures`, `/books`, `/content/…` enz. Zet de publieke URL in `CORS_ORIGIN`.
Bij vorm B (frontend apart): bouw de frontend met `VITE_API_URL=https://api.example.com` en zet
`SERVE_FRONTEND=false`.

---

## 3. Deploy — met Docker

```bash
# verse database + volumes
ADMIN_TOKEN=$(openssl rand -hex 32) CORS_ORIGIN=https://ilmnet.example \
  docker compose -f server/docker-compose.yml up -d --build

# eenmalig bij een verse database: referentiedata toevoegen
# (de image bevat server/dist, dus gebruik de gecompileerde seed — geen tsx/src nodig)
docker compose -f server/docker-compose.yml exec server node dist/seed.js --reference
```

Wat de artifacts al regelen:

- `server/Dockerfile` — multi-stage `node:20-alpine`, non-root (`USER node`), healthcheck op
  `/api/health`, start met `npx prisma migrate deploy && node dist/server.js`, mountpoint
  `/app/uploads`.
- `server/docker-compose.yml` — Postgres 17 met healthcheck, `ADMIN_TOKEN` verplicht (`:?`),
  `CORS_ORIGIN` expliciet, `UPLOADS_DIR=/app/uploads` op volume `uploads_data`, en de
  frontend-build read-only op `/app/frontend` (`../dist` uit de repo).
- `server/.dockerignore` — houdt `.env`, `uploads/`, `node_modules/`, `dist/` en tests buiten de
  image, zodat er geen secrets of lokale state meebakken.

---

## 4. Seed — belangrijk

De seed kent twee modi:

| Commando | Wat het doet | Veilig in productie |
| --- | --- | --- |
| `npm run seed:reference` | Upsert van subjects + scholars. Raakt **geen** content. Idempotent. | ✅ ja — gebruik dit bij een verse DB |
| `npm run seed` | **Wist alles** (content, scholars, subjects, importjobs) en zet demodata neer | ❌ nee — weigert bij `NODE_ENV=production` |

De demo-seed stopt in productie met een duidelijke melding en exit-code 1. Alleen als je een
productiedatabase bewust wilt leegvegen: `SEED_ALLOW_RESET=true npm run seed`.

---

## 5. Verificatie na elke deploy

```bash
curl -s https://ilmnet.example/api/health   # status ok, database up, storage.writable true, adminProtection true
```

- `/` en diepe links (`/lectures`, `/books`, `/series/<id>`, `/lectures/<slug>`) geven 200 en
  renderen na een harde refresh (SPA-fallback).
- Admin: `/admin` vraagt om het token; met het juiste token verschijnen drafts, imports en uploads.
- Upload-test: voeg in het CMS een thumbnail toe, herlaad de pagina — het bestand moet daarna nog
  steeds geserveerd worden (bewijs dat `UPLOADS_DIR` op een volume staat).
- Bij het starten logt de server de storage-audit, bv.
  `Upload storage ready at /var/lib/ilmnet/uploads — 3 referenced file(s), 0 unused on disk`.
  Staat er `Missing upload file(s) referenced by the database: …`, dan is het volume niet gemount.

---

## 6. Updaten en terugrollen

1. `git pull` → `npm ci` (root + server) → `npm run build` + `server: npm run build`.
2. `npx prisma migrate deploy` (idempotent; migraties zijn additief).
3. Service herstarten (`systemctl restart ilmnet` / `docker compose up -d --build`).

Uploads staan buiten de image op een volume en blijven dus staan bij een redeploy; de database
verwijst naar `/uploads/<bestand>` en de server controleert bij het opstarten of die bestanden er
zijn. Rollback = vorige image/commit terugzetten en opnieuw starten; migraties zijn voorwaarts
geschreven, dus draai geen `migrate reset` op productie.

---

## 7. Problemen oplossen

| Symptoom | Oorzaak / oplossing |
| --- | --- |
| Server start niet, `ADMIN_TOKEN is required when NODE_ENV=production` | Token ontbreekt. Zet `ADMIN_TOKEN` in de echte omgeving (niet in een `.env` die per ongeluk meegaat). |
| `A .env file may not configure a production boot: …` | Er staat een (dev-)`.env` in de servermap die `NODE_ENV`/`ADMIN_TOKEN`/`CORS_ORIGIN` zou leveren. Verwijder het bestand van de productiehost of zet die variabelen in de serviceomgeving. |
| `NODE_ENV is not set in the process environment, but deployment configuration was found there` | Je start met een echte `DATABASE_URL`/`ADMIN_TOKEN`/`CORS_ORIGIN`, maar zonder `NODE_ENV`. Zet `NODE_ENV=production` (deployment) of `NODE_ENV=development` (lokale run). |
| `ADMIN_TOKEN is too short for production` / `ADMIN_TOKEN is a known development/example value` | Genereer een nieuw token: `openssl rand -hex 32`. |
| `CORS_ORIGIN="*" is not allowed in production` | Zet de exacte publieke origin(s) in `CORS_ORIGIN`. |
| `P1012` / `Environment variable not found: DATABASE_URL` | `DATABASE_URL` ontbreekt of is leeg in de procesomgeving. |
| Admin geeft 401 | Verkeerd/ontbrekend token: opnieuw instellen via **Admin → Token**. |
| Thumbnails 404, boot-waarschuwing over ontbrekende uploads | `UPLOADS_DIR` staat niet op een persistent volume, of het volume is niet gemount. |
| Diepe link geeft 404 | Reverse proxy onderschept de route; stuur alles naar de Node-service of zet `SERVE_FRONTEND=true`. |
| Archive-import faalt met `ARCHIVE_FETCH_FAILED` | Tijdelijke rate-limit bij archive.org — opnieuw proberen. |

---

## 8. Health check (voor orchestrators)

`GET /api/health` → **200** met `{ status, env, database, storage: { dir, persistent, writable, files, bytes }, adminProtection }`;
**503** zodra de database of de uploadopslag onbruikbaar is. Dit endpoint zit ook in de
`HEALTHCHECK` van de Dockerfile.
