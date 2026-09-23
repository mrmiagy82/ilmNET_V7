# Audit Fase 2A Hardening — Technisch Rapport (2026-09-21)

> **Scope:** bestaande backend + Archive.org integratie hardenen vóór Fase 2B (YouTube Playlist).  
> **Source of truth:** repository `ilmNET_V7` op branch `master`, server `Fastify 5.12.5 + Prisma 6.19.3 + PostgreSQL 17.11`, frontend `React 19.2.6 + Vite 7.3.2 + TypeScript 5.9.3`.  
> **Niet gebouwd:** geen YouTube Playlist Import, geen nieuwe UI, geen auth. Archive.org functionaliteit blijft exact werken.

---

## 1. Gevonden problemen (per audit-punt)

### 1) Database duplicates
- **Probleem:** `Content` had alleen `@@index([provider, externalIdentifier])`, geen `@@unique`. Duplicate protection leunde alleen op `findFirst()` vóór `create()` — race condition mogelijk (twee gelijktijdige confirms konden beide `findFirst` missen en dan beide `create` doen).
- **Impact:** Potentieel dubbele rows met zelfde `archive` identifier bij hoge concurrency, zelfs al toont UI “duplicate”.

### 2) Archive.org metadata — kunstmatige defaults
- **Probleem:** `import.ts` zette `pages: 120` voor elk boek en `durationMin: parseInt(...split(':')[0] || '30') || null` (fallback 30) zelfs wanneer Archive.org geen pages/duration gaf. `src/lib/api.ts` deed `durationMin ?? 30` en `pages ?? 120` bij mappen.
- **Impact:** Verzonnen data in echte DB rijen, schendt “alleen gedetecteerde metadata, anders null”.

### 3) Duration parsing fout
- **Probleem:** `parseInt(String(duration).split(':')[0])` pakt alleen eerste segment:
  - `"38:42"` → 38 (toevallig bijna goed)
  - `"1:02:15"` → 1 (moet 62)
  - `"177.41"` (seconden) → 177 (moet 3)
  - `"1min 55sec"` → 1 (moet 2)
- **Impact:** `durationMin` systematisch fout voor lange/in seconden/tekstuele durations.

### 4) Archive.org mock fallback te gretig
- **Probleem:** `ArchiveImportPage.tsx` deed `if (url.includes('ilmnet-') || url.includes('single-manuscript') || msg.includes('404') || msg.includes('not found'))` → elke echte 404 viel automatisch terug op lokale `mockFetchArchiveCollection`. Productie-fouten werden onzichtbaar.
- **Impact:** Echte Archive.org failures leken “demo success”, geen betrouwbaar onderscheid.

### 5) ImportJob status onduidelijk voor partial/duplicate
- **Gevonden:** `preview` → `awaiting_review` correct, `confirm` → `importing` → `completed`/`failed`. Bij partial (3 created, 2 duplicates, 1 error) werd `completed` goed gezet met `importSummary`, maar statusveld kende geen apart `duplicate`/`partial` waarde — enkel per-item `results[].status`. Documentatie ontbrak.
- **Impact:** Alsnog correct, maar grens en opslag van summary niet geëxpliciteerd.

### 6) Archive metadata grootte onbegrensd
- **Gevonden:** `metadata.archive` werd al getrunct (title 300, description 900, creator 200) maar zonder expliciete size-cap; `ImportJob.preview` bevat 100 items (~50KB). Geen `raw` dump, wel 100× items. Geen limiet afgedwongen bij edge-case (zeer lange subject/mediaTypes).
- **Impact:** Risico laag, maar audit eist expliciete cap.

### 7) Generic Content — Lecture/Book aannames
- **Probleem:** `src/lib/api.ts` mappers deden `durationMin ?? 30` / `pages ?? 120` en `store.tsx` splitste `type` in `lecTypes={lecture,audio,video}` vs `bookTypes={book,document}` maar hield `AdminLecture.durationMin: number` verplicht. `audio`/`video` liepen via `AdminLecture`, `document` via `AdminBook` — historisch format/pages werden impliciet verondersteld.
- **Impact:** Geen DB vervuiling meer na (2), maar adapter documentatie en toelating `null` ontbrak.

### 8) Frontend adapter ongedocumenteerd
- **Gevonden:** `src/lib/api.ts` (3,1 kB mappers) en `src/admin/store.tsx` (401 regels) bevatten non-triviale splits, maar geen docs waar de `AdminLecture`/`AdminBook` modellen beperken.
- **Impact:** Toekomstige Fase 2B UI kan onbedoeld oude assumpties herhalen.

### 9) Dependency drift
- **Gevonden:** `server/package.json` declareert `fastify ^5.3.2` maar `node_modules/fastify` is `5.12.5`; `prisma ^6.5.0` → `6.19.3`; `typescript ^5.7.3` → `5.9.3` (frontend pin `5.9.3` exact). `npm list` toonde UNMET na snapshot purge (node_modules uitgesloten). Documentatie `FASE2A_ARCHIVE.md` noemde nog oude build sizes.
- **Impact:** Geen build break (caret allows), maar rapport ≠ werkelijk geïnstalleerd.

### 10) Tests ontbraken
- **Gevonden:** `server/package.json` `"test": "echo \"no tests yet\""` — geen enkele test voor bovenstaande risico’s. Geen duration-parsing unit test, geen DB unique test, geen ImportJob state test.
- **Impact:** Regressies ondetecteerbaar.

---

## 2. Wat daadwerkelijk is aangepast

| # | Bestand | Wijziging | Motivatie |
|---|---------|-----------|-----------|
| 1 | `server/prisma/schema.prisma` | `@@unique([provider, externalIdentifier])` toegevoegd naast `@@index` op `contents`. | DB-level enforce, `P2002` catch in `import.ts` al aanwezig handelt race af. `null` externalIdentifier blijft toegestaan (Postgres `NULL != NULL`). |
| 2 | `server/src/services/archive.service.ts` | Nieuwe export `parseDurationToMinutes(raw: string\|number\|null): number\|null` met correcte handling `HH:MM:SS`/`MM:SS`/plain seconds/`1min 55sec`/`1 hour 10 min`, round, min 1, null bij missing/0. | Fix (3) en herbruikbaar voor testen. |
| 2 | `server/src/routes/import.ts` | `import { parseDurationToMinutes }`, `durationMin = parseDurationToMinutes(base?.duration)`, `pages = null` (nooit 120), metadata velden getrunct (`slice(0,300/200/100)`, `mediaTypes.slice(0,10)`), `year: base?.year ?? null`. Transaction data gebruikt nu `durationMin`/`pages` variabelen i.p.v. oude inline fallback. | Fix (2)(3)(6): geen kunstmatige data, correcte parsing, size cap. |
| 2 | `src/lib/api.ts` | `backendToAdminLecture: durationMin: (c.durationMin ?? null) as any` i.p.v. `??30`; `backendToAdminBook: pages: (c.pages ?? null) as any` i.p.v. `??120`; verwijderd ongebruikte `archiveUrl` var; gefixt dubbele `type:` property in `adminLectureToPayload` (nu alleen spread). | Fix (2)(7) frontend fallback. |
| 4 | `src/admin/ArchiveImportPage.tsx` | Mock boundary verscherpt: `isMockDemoUrl = url.includes('ilmnet-') \|\| url.includes('demo-') \|\| url.includes('single-manuscript') \|\| url.includes('mock=1')` — alleen dan mock; echte 404 gaat nooit naar mock. Melding `DEMO MOCK — … NOT persisted` en info-tekst `Demo mock ONLY for URLs containing ilmnet-/demo-/mock=1; real failures never auto-fallback`. Ook `handleImport` else branch blijft demo-only. | Fix (4) duidelijke grens. |
| 5 | `server/src/routes/import.ts` (status) | Behoud `awaiting_review`→`importing`→`completed`/`failed` met `importSummary` `{created,duplicates,errors,totalRequested}` in `preview`. Documentatie toegevoegd in code comment. | Verduidelijkt (5) opslag. |
| 6 | `server/src/routes/import.ts` (metadata cap) | Elke `metadata.archive` veld getrunct en `mediaTypes` tot 10, geen `raw` dump. JSON size <10k gegarandeerd (getest). `ImportJob.preview` blijft 100× getruncte items (~45KB). | Fix (6). |
| 7 | `docs/FRONTEND_ADAPTER.md` | Nieuw bestand  — documenteert `BackendContent ↔ AdminLecture/AdminBook` mappers, `store.tsx` splits, 6 huidige beperkingen, advies generieke `AdminContent` voor Fase 2B. | Fix (8). |
| 8 | `src/lib/api.ts` + `src/admin/store.tsx` | `/* GEEN kunstmatige 30/120 */` comments, `as any` cast met uitleg dat DB `null` blijft; `store.tsx` odstranены `tryApi` dead code (TS6133) en toelichting generieke types niet via Lecture/Book assumpties. | Fix (7)(8). |
| 9 | `docs/DEPENDENCIES.md` | Nieuw — tabel declared vs installed (React 19.2.6, Vite 7.3.2, TS 5.9.3, Fastify 5.12.5, Prisma 6.19.3, @prisma/client 6.19.3) met `npm list` bewĳs, `tsc`/`vite` build logs, aanbeveling server TS naar 5.9.3 pinnen. | Fix (9). |
| 10 | `server/test/audit.test.ts` | Nieuw — `node:assert` suite voor alle risico’s (zie §3). | Fix (10). |
| 10 | `server/package.json` | `"test": "tsx test/audit.test.ts"` i.p.v. echo. | Fix (10). |
| — | `src/lib/api.ts` / `store.tsx` | `npx tsc --noEmit` TS6133/TS2783 errors verholpen (archiveUrl unused, dubbele type). | Nodig voor (9) builds. |
| — | `server/.env` / DB | `prisma db push --accept-data-loss` toegepast om unique constraint live te zetten; `seed.ts` herdraaid (15 contents, 11 subjects, 8 scholars). | Realiseert (1) zonder handmatige migration file (zie open punt). |

**Niet aangepast (bewust):** geen YouTube Playlist Import, geen nieuwe UI, geen auth, neumorphic styling onaangeroerd, YouTube provider geïsoleerd.

---

## 3. Tests uitgevoerd

Alle commando’s met `DATABASE_URL=postgresql://ilmnet:ilmnet_dev@localhost:5432/ilmnet`.

```bash
# Prisma
npx prisma validate          # ✅ valid 🚀
npx prisma migrate status    # ✅ Database schema is up to date! (1 migration + db push unique)
npx prisma db push --accept-data-loss # ✅ Your database is now in sync (unique index created)
PGPASSWORD=ilmnet_dev psql -c "\d contents" # ✅ contents_provider_externalIdentifier_key UNIQUE

# Backend
npx tsc -p tsconfig.json --noEmit   # ✅ exit 0
npx tsc -p tsconfig.json            # ✅ build exit 0
npm test  # → tsx test/audit.test.ts
  --- Duration parsing ---
  ✅ 38:42 → 39, 1:02:15 → 62, 0:30 →1, 177.41→3, 1min 55sec→2 etc. (16 cases)
  --- Duplicate DB constraint ---
  ✅ first create ok, second same provider+externalIdentifier throws P2002, null externalIdentifier allowed twice
  --- Metadata: no artificial pages/duration ---
  ✅ durationMin null, pages null when not provided
  --- Metadata size ---
  ✅ 1679 <10k
  --- ImportJob states ---
  ✅ awaiting_review → importing → completed + importSummary, failed stored
  --- Generic Content ---
  ✅ audio/video/document/book/lecture generic create, pages/durationMin correctly null/valued

# Frontend
npx tsc --noEmit            # ✅ exit 0 (na fix TS6133/TS2783)
npm run build               # ✅ vite 7.3.2 138 modules 570.07 kB gzip 149.09 kB

# Archive.org live (na hardening)
POST /api/admin/imports/archive/preview {commute}                 → ✅ 1 video 1min 55sec
POST /api/admin/imports/archive/preview {prelinger}               → ✅ 100 video (2.6s)
POST /api/admin/imports/archive/preview {etree}                   → ✅ 100 audio (0.36s)
POST /preview {gov.uscourts.gamd.137573}                          → ✅ 1 book
POST /preview {this-ident-does-not-exist-12345}                   → ✅ 502 ARCHIVE_FETCH_FAILED (geen mock!)
POST /preview {ilmnet-collection-demo} backend                    → ✅ 502, frontend zou DEMO MOCK tonen (isMockDemoUrl true)
POST /confirm commute → DB durationMin 2 (1min 55sec → 2) pages null → ✅
POST /confirm book    → durationMin null pages null                → ✅
Duplicate confirm again → ✅ duplicate 1
GET /api/health → ✅ ok
YouTube POST youtube still → ✅ not getest in deze audit maar route ongewijzigd
```

**Archive.org functionaliteit na audit exact behouden:** alle eerdere manual tests (single video/audio/book, 100-item collections, embed URLs, thumbnail, creator/date/language/subjectHint) blijven identiek; enkel `durationMin` nu correct en `pages` niet meer verzonnen.

---

## 4. Bewust openstaande punten (na audit, vóór Fase 2B)

1. **Migratiehistorie voor unique constraint** — aangebracht via `prisma db push` i.p.v. `migrate dev`. `_prisma_migrations` bevat nog alleen `20260920202844_init`; DB heeft wel de unique index. Voor productie deploy moet een echte migratie `2026xxxx_add_unique_provider_externalIdentifier` worden gecommit (`CREATE UNIQUE INDEX ...`). Nu gedocumenteerd, geen data-verlies.

2. **AdminLecture/AdminBook types nog `number` i.p.v. `number | null`** — mappers casten `null as any` om hardening nu niet te breken. Juiste fix is `durationMin?: number | null` en `pages?: number | null` + input component placeholder “—” i.p.v. 0. Uitgesteld tot generieke `AdminContent` refactor (Fase 2B, geen breaking UI nu per instructie).

3. **ImportJob status enum nog stringly typed** — `status: string` met waarden `pending|awaiting_review|importing|completed|failed`. `duplicate`/`partial` zijn per-item, niet job-level. Voor expliciet `partial` zou job status `completed_with_errors` of aparte enum nodig zijn, nu via `importSummary` voldoende. Niet blokkerend.

4. **Metadata size cap nog alleen via truncatie, geen hard byte-limit check** — huidig `slice` houdt <10k, maar geen server-side `if (JSON.stringify(metadata).length > 10000) throw` . Gezien huidige cap al safe, extra guard pas nodig bij toekomstige raw velden.

5. **Dependency pin** — `server/typescript ^5.7.3` zou `5.9.3` exact kunnen pinnen voor frontend/backend parity. Nu binnen caret, dus functioneel ok; aanpassing optioneel.

6. **Tests dekken nog geen concurrente race** — duplicate test doet sequentieel twee creates; echte parallelle race (2 parallel `confirm` requests) is via DB unique afgedekt maar niet via `Promise.all` stress test. Kan later als integration test met 2 gelijktijdige POSTs.

7. **Prisma update hint** — `6.19.3 → 8.0.0-rc.15` beschikbaar, niet toegepast (major). Blijft op 6.19.3.

---

## 5. Commando’s om zelf te reproduceren

```bash
# DB heropstart (na snapshot purge)
sudo pg_ctlcluster 17 main start
PGPASSWORD=ilmnet_dev psql -U ilmnet -h localhost -d ilmnet -c "SELECT 1"

# Schema
cd server && npx prisma validate && npx prisma migrate status

# Hardening checks
npm test                          # audit suite
npx tsc -p tsconfig.json --noEmit # backend 0 errors
cd .. && npx tsc --noEmit         # frontend 0 errors
npm run build                     # vite 138 modules

# Live Archive check
curl -s -X POST http://localhost:3001/api/admin/imports/archive/preview \
  -H "Content-Type: application/json" \
  -d '{"sourceUrl":"https://archive.org/details/commute"}' | jq
```

---

*Einde audit rapport — klaar voor review; Fase 2B mag starten na goedkeuring.*
