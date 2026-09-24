# Fase 3.7 — Production Readiness

**Doel:** ilmNet klaarmaken voor echte deployment op zes vlakken — Storage, Security, Database,
API, Frontend en Deployment — zonder nieuwe features, redesign of mocks, en zonder de bestaande
Archive/YouTube-imports, series/collections, waveform, thumbnails, downloads en Admin CMS te breken.

**Bewijs:** alle suites groen (zie [Testoverzicht](#testoverzicht)) incl. een nieuwe
productie-e2e in een echte browser tegen de API die zelf de gebouwde frontend serveert.

---

## 1. Storage

- **`server/src/lib/storage.ts` (nieuw)** centraliseert alles rond uploads:
  `UPLOADS_DIR`-resolutie (default `<server>/uploads`), `ensureUploadsDir`, `isUploadsDirWritable`,
  `listUploadFiles`, `uploadsHealth { dir, persistent, writable, files, bytes, custom }` en
  `auditUploadReferences` (DB-verwijzingen ↔ bestanden op schijf, missing/orphan).
- **Custom thumbnails verdwijnen niet meer stil bij deployment.** Bij het opstarten vergelijkt de
  server de `/uploads/...`-verwijzingen in de database met de map op schijf en logt een expliciete
  waarschuwing, bijvoorbeeld:
  `Missing upload file(s) referenced by the database: e2e-custom-thumb-….png — mount the uploads volume or re-upload.`
- **`/api/health`** rapporteert `storage.dir`, `persistent`, `writable`, `files`, `bytes`
  (200 bij gezond, 503 zodra database óf storage onbruikbaar is).
- **Deployment:** `UPLOADS_DIR` naar een persistent volume (`docker-compose.yml`: `uploads_data`
  op `/app/uploads`). Geen nieuwe storage-provider toegevoegd: de bestaande schijfopslag blijft,
  maar is nu expliciet configureerbaar en persistent te mounten.
- **Upload-endpoints gehard** (`server/src/routes/uploads.ts`): extensie-allowlist, 5 MB-limiet,
  traversal-bescherming (400), niet-multipart → `400 NO_FILE`/`BAD_UPLOAD`, verwijderen alleen
  binnen de uploadmap.

## 2. Security

| Onderwerp | Status |
| --- | --- |
| Admin-token | Productie **verplicht**: boot faalt zonder `ADMIN_TOKEN` (fail-fast). `timingSafeEqual`-vergelijking. |
| Beschermde routes | Alle `POST/PATCH/PUT/DELETE` onder `/api/*` **en** alle `/api/admin/*` reads (draft/archived lek). |
| Dev-bypass | Alleen buiten productie; met `ADMIN_ALLOW_LOCALHOST=false` te sluiten. |
| CORS | `CORS_ORIGIN` expliciet; `*` in productie is een boot-fout. |
| Logs | Tokens/authorization-headers worden geredigeerd. |
| Headers | `X-Content-Type-Options: nosniff`, referrer-policy, 1 MB bodyLimit, `trustProxy`. |
| Secrets in Git | Geen token in de frontendbundle (geverifieerd), geen `.env` in Git, `.env.example` als template. |

## 3. Database

- Prisma-schema ongewijzigd: `slug` uniek op Content/Scholar/Subject, `@@unique([provider, externalIdentifier])`
  (dubbele imports worden geweigerd, P2002), join-tabellen met cascade-delete, indexes op
  `status/publishedAt`, `type+provider`, `collectionIdentifier`, `language`, `title`, `series`.
- **Duplicates:** bewezen in de import-suite (`duplicate single correctly throws P2002`,
  `duplicate playlist item correctly throws P2002`) en in de import-regressie
  (`created/duplicates`-samenvatting).
- **Content verwijderen:** hard delete wist join-records mee; een Subject met gekoppelde content
  geeft `409` in plaats van stil dataverlies.
- **Importgedrag:** playlist/bulk worden gegroepeerd via `collectionIdentifier` + `collectionTitle`
  (geverifieerd: 7 playlist-afleveringen, 8 boeken, 3 audiotracks).

## 4. API

- Publieke reads geven **uitsluitend** `published` terug; `draft`/`archived` lek getest op
  `/api/contents`, `/api/scholars`, `/api/subjects` (id én slug).
- Legacy publieke write-/publish-aliassen verwijderd; alles wat schrijft zit onder `/api/admin/*`.
- Statuscodes: `400` bij ongeldige input/upload, `401` zonder token, `404` JSON (`NOT_FOUND`) voor
  onbekende API-routes, `409` bij conflicten, `413`/`415` bij te grote/verkeerde uploads.
- Frontend toont de Nederlandse 401-melding uit `ApiError` met status/code.

## 5. Frontend

- **Directe URL's en refresh werken nu echt.** De app gebruikte `HashRouter`, waardoor
  `/lectures` of `/content/…` altijd de landingspagina toonde. Nu `BrowserRouter` in combinatie
  met de SPA-fallback op de server; oude gedeelde links (`/#/lectures/…`) worden bij het laden
  automatisch doorgestuurd naar het echte pad (`src/main.tsx`).
- **Publieke pagina's bevragen geen admin-endpoints meer.** De `AdminProvider` hing aan de root en
  deed bij élke paginaweergave drie admin-requests (401 met tokenbeveiliging aan). De provider zit
  nu alleen om de `/admin`-routes.
- Loading-, empty- en error-states gecontroleerd met echte requests (delay- en abort-injectie):
  skeleton + `—`-stats tijdens laden, `Could not load lectures` + `Try again`, en op de detailpagina
  een foutkaart met terug-link — nooit een blanco pagina.
- **Kapotte thumbnails** (bestand ontbreekt, bv. uploads-volume niet gemount): het frame blijft
  staan, de afbeelding wordt verborgen en de ilmNet-fallback (waveform-balken / audio-placeholder)
  wordt getoond — geen broken-image-icoon.
- **Embeds/players:** YouTube-iframe met de echte video-id + "Open original", Archive-reader voor
  boeken, eigen audioplayer met waveform en een échte MP3-downloadlink; zonder embed altijd een
  leesbare fallback in plaats van een zwart vlak.
- **Mobile (390×844):** geen horizontale overflow op publieke pagina's én alle admin-pagina's
  (de activity-grid in `Overview.tsx` liep 27 px buiten het scherm — opgelost met `min-w-0`).
- Console-fouten van derde-partij embed-scripts (Archive.org BookReader, YouTube) zijn
  geïdentificeerd als extern (`details-bookreader.min.js`); de eigen app is foutenvrij.

## 6. Deployment

- **Artifacts:** `server/Dockerfile` (multi-stage, `node:20-alpine`, prisma generate + build,
  non-root `USER node`, healthcheck op `/api/health`, start met `prisma migrate deploy && node dist/server.js`).
- **`server/docker-compose.yml`:** Postgres 17 met healthcheck, `ADMIN_TOKEN` verplicht (`:?`),
  `CORS_ORIGIN` expliciet, `UPLOADS_DIR=/app/uploads` op volume `uploads_data`, optioneel
  `../dist` read-only op `/app/frontend` met `SERVE_FRONTEND=true`.
- **Env-vars gedocumenteerd** in `.env.example` (root) en `server/.env.example`:
  `DATABASE_URL`, `PORT`, `HOST`, `NODE_ENV`, `CORS_ORIGIN`, `ADMIN_TOKEN`, `UPLOADS_DIR`,
  `FRONTEND_DIR`, `SERVE_FRONTEND`, `ADMIN_ALLOW_LOCALHOST` (+ waarschuwing: `VITE_ADMIN_TOKEN`
  nooit in een productiebuild).
- **Eén origin:** de API serveert de gebouwde SPA (`GET /` en deep links → `index.html`, onbekende
  `/api/*` → JSON 404). Getest door de productieserver op `NODE_ENV=production` te starten en de
  echte `dist/` te serveren.

---

## FIXED

| # | Probleem | Oplossing |
| --- | --- | --- |
| 1 | Custom thumbnails konden stil verdwijnen bij deployment (geen zicht op ontbrekende bestanden) | `storage.ts` + boot-audit + `storage`-blok in `/api/health` + `UPLOADS_DIR` op persistent volume |
| 2 | Admin-writes en admin-reads waren in dev volledig open en in productie niet afgedwongen | Token-hook over alle writes én `/api/admin/*` reads, fail-fast in productie, `timingSafeEqual`, dev-bypass uitschakelbaar |
| 3 | Legacy publieke write/publish-aliassen op content-endpoints | verwijderd; schrijven kan alleen via `/api/admin/*` |
| 4 | Subject verwijderen met gekoppelde content faalde onduidelijk / kon data verliezen | expliciete `409` met melding |
| 5 | Geen health-signaal voor database + storage | `/api/health` met 200/503 en storage-details |
| 6 | CORS stond `*` toe in productie | boot-fout bij `CORS_ORIGIN=*` in productie |
| 7 | **Directe URL's/deep links toonden altijd de homepage** (HashRouter) | `BrowserRouter` + SPA-fallback, oude `#/…`-links worden doorgestuurd |
| 8 | **Elke publieke pagina deed 3 admin-requests (401 in productie)** | `AdminProvider` alleen om `/admin`-routes |
| 9 | `href="#/subjects"`-link werkte niet meer met echte paden | vervangen door router-`<Link to="/subjects">` |
| 10 | **Admin Overview liep horizontaal buiten het scherm op mobiel (417 px bij 390 px)** | `min-w-0` op grid/secties |
| 11 | Keuze tussen directe MP3 en embed-fallback was niet getest | e2e toont: directe `archive.org/download/…mp3` + 206 audio-bytes bij download |
| 12 | Geen productie-start/verify pad (build + env + SPA-serving) | `server/Dockerfile`, `docker-compose.yml`, `.env.example` (root + server), scripts |
| 13 | **Upload-delete accepteerde een pad met `../` en meldde succes** (werd stil teruggebracht tot de basename in `uploads/`) | strikte bestandsnaamvalidatie: alleen `[A-Za-z0-9][A-Za-z0-9._-]*`, geen `..`, geen dotfiles → `400 INVALID_FILENAME`; traversal-varianten (incl. `%2e%2e%2f`, dubbel-gecodeerd) getest |
| 14 | **Docker-build kon `server/.env` (dev-token), `uploads/` en `node_modules` in de image bakken** (`COPY . .` zonder ignore-bestand) | `server/.dockerignore` toegevoegd; `.env` geweigerd, `.env.example` behouden, `uploads/` alleen op het volume |

## SAFE (gecontroleerd, geen wijziging nodig)

- **Security:** token alleen via header/sessionStorage, nooit in de bundle; logging redigeert tokens;
  geen secrets of `.env` in Git; uploads met allowlist/limiet/traversal-check; geen exponering van
  draft of archived via publieke endpoints.
- **Database:** unieke slugs, `provider+externalIdentifier` uniek (duplicate-import geweigerd met
  P2002), cascade-deletes op join-tabellen, indexes op de querypaden.
- **API:** consistente JSON-foutvorm (`error.code`/`message`), 400/401/404/409/413/415 gedekt door
  tests, publieke lijst toont uitsluitend `published`.
- **Frontend:** loading/empty/error-states op publieke en admin-pagina's; broken thumbnails,
  ontbrekende embeds en mislukte API-calls vallen netjes terug; refresh en directe URL's werken;
  geen horizontale overflow op 390 px, console foutenvrij op eigen code.
- **Bestaande functionaliteit:** echte Archive/YouTube-imports (single, playlist, boekenreeks,
  audioreeks), series/collections-groepering, waveform tijdens echte weergave, custom thumbnails,
  downloads en Admin CMS — allemaal opnieuw bewezen in deze fase.

## Eindcontrole (final production check)

De volledige productieomgeving is na de hardening nog één keer end-to-end doorgemeten tegen een
écht draaiende server (`NODE_ENV=production`, `ADMIN_TOKEN` actief, echte imports, geen mocks):

| Controle | Resultaat |
| --- | --- |
| Productieserver + SPA deep links | `GET /` → 200 met de gebouwde app; 10 deep links + hard refresh OK; onbekende API-route → JSON 404 |
| ADMIN_TOKEN / security | admin-read zonder token 401, met fout token 401, met juist token 200; publieke write geblokkeerd (401); draft/archived niet in publieke lijst, publieke detail-URL van een draft 404, admin ziet ze wél |
| CORS + env | toegestane origin krijgt CORS-header, onbekende origin niet; preflight 204; `nosniff` + referrer-policy aanwezig; productie-boot zónder token faalt (exit 1, duidelijke melding), `CORS_ORIGIN=*` in productie faalt, ontbrekende `DATABASE_URL` faalt |
| Uploads / storage | niet-multipart → 400 `NO_FILE`; traversal-varianten → 400/404 en sentinel buiten `uploads/` blijft intact; geldige delete werkt; `/api/health` toont storage `dir/writable/files` |
| Public vs admin API | publiek alleen `published`; alle writes onder `/api/admin/*` met token |
| Database / migraties | 2 migraties toegepast; unieke indexen (slug, provider+externalIdentifier); 4 cascade-FK's; duplicate-import → 409; join-rijen cascade-verwijderd bij hard delete |
| Archive/YouTube imports | 19/19 (single + playlist van 7 + 8 boeken + 3 audiotracks, echte downloads 302 → 206 `audio/mpeg`) |
| Audio waveform/player | 27/27 media-e2e: echte weergave, 18 frames variatie, live waveform, pause/reset, seek op 50% |
| Thumbnails | custom upload wint van provider-thumbnail (kaart + detail), ontbrekend bestand valt netjes terug, geen zwarte Archive-afbeelding |
| Mobile/desktop | 14 routes zonder horizontale overflow op 390×844; desktop 1366×900 volledig doorgelopen |
| Tests + build | audit ✅, uploads 25/25, production 42/42, YouTube 14+, media-e2e 27/27, productie-e2e 61/61; `tsc` 0 fouten; build 637 kB (gzip 161 kB); geen token in de bundle |

Nieuwe bevindingen uit deze controle zijn opgelost en staan als #13 en #14 in de FIXED-tabel.

**Operationele noot (belangrijk bij uitrol):** de server leest naast echte env-variabelen ook
`server/.env` (dotenv + de Prisma-client). Dat is handig lokaal, maar betekent dat een achtergebleven
`server/.env` met een dev-token de productie-boot wél laat slagen — met een bekend token. Daarom:
`.env` staat in `.gitignore`, in `server/.dockerignore` en in de image; geef in productie
`ADMIN_TOKEN` via de echte omgeving (of `--env-file`) en gebruik een lang, uniek token.

## BLOCKER

- **Geen.** Alles wat in deze fase is gevonden, is opgelost; alle suites zijn groen.
- Twee punten om te weten bij de uitrol (geen blokkades):
  1. **Docker is in deze sandbox niet beschikbaar**, dus `Dockerfile`/`docker-compose.yml` zijn
     geschreven en inhoudelijk nagelopen, maar niet hier gebouwd. Het equivalent (build +
     `NODE_ENV=production node dist/server.js`) is wél volledig getest.
  2. **Archive.org rate-limit:** de metadata-API gaf één keer een transient 502 tijdens bulk
     testimports. Dit is providergedrag (opnieuw draaien lukte direct); de importcode rapporteert het
     als `ARCHIVE_FETCH_FAILED`, zonder dataverlies.

---

## Testoverzicht

| Suite | Commando | Resultaat |
| --- | --- | --- |
| Audit | `cd server && npx tsx test/audit.test.ts` | ✅ all passed |
| Uploads/thumbnails | `cd server && npx tsx test/uploads.test.ts` | ✅ 25/25 |
| Production readiness (API/security/deploy + SPA-serving + upload-delete) | `cd server && npm run test:production` | ✅ 42/42 |
| YouTube-import | `cd server && npx tsx test/youtube.test.ts` | ✅ 14+ cases |
| Echte imports-regressie (Archive + YouTube) | `cd server && npm run test:imports` (backend nodig) | ✅ 19/19 |
| Media-e2e (Fase 3.6-ijkpunt) | `npm run test:e2e` | ✅ 27/27 |
| Productie-e2e in de browser | `npm run test:e2e:production` | ✅ 61/61 |
| Frontend | `npx tsc --noEmit` + `npm run build` | ✅ 0 fouten, `dist/index.html` 637 kB (gzip 161 kB) |

**Import-regressie in het kort:** YouTube-single (1 video), YouTube-playlist (7 afleveringen → één
serie "Islamic Lectures"), Archive-boekenreeks (8 boeken → `CollectionOfIslamicBooks`) en
Archive-audio (3 tracks → `RenewingOurIntentions`) worden geïmporteerd, gepubliceerd en gegroepeerd;
de audiotrack levert een werkende `archive.org/download/….mp3` (302 → 206, `audio/mpeg`).

**Productie-e2e in het kort:** 10 directe URL's + hard refresh, oude `#/`-links, loading-state,
API-fout (abort) met leesbare foutkaart, ontbrekend thumbnailbestand, echte embeds (YouTube-iframe,
Archive-reader, eigen audioplayer met MP3-download), admin zonder token, en 14 routes zonder
horizontale overflow op mobiel.
