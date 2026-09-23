# ilmNet Backend — Verificatie Fase 0 & 1 (2026-09-20)

## 1. Database & Migratie
- **PostgreSQL 17.11** geïnstalleerd (`sudo apt-get install postgresql` — geen docker beschikbaar).
- Cluster gestart (`pg_lsclusters` was down → `service postgresql start`).
- DB `ilmnet` + user `ilmnet:ilmnet_dev` aangemaakt, grant + `CREATEDB`/`SUPERUSER` voor shadow DB.
- `.env`: `postgresql://ilmnet:ilmnet_dev@localhost:5432/ilmnet?schema=public` (PORT 3001).
- **Prisma migrate** `20260920202844_init` succesvol toegepast; `prisma generate` v6.19.3.

### Schema-validatie (consistency checks geslaagd)
- `provider` = `google_books` (underscore, niet `google-books`) — `normalizeProvider` doet dash→underscore.
- `Content.series String?` aanwezig, `Scholar.specialtyId String? @relation(onDelete:SetNull)`.
- `Content.metadata Json?` voor Archive.org extra velden (creator, available_media, collection …).
- `Content.collectionIdentifier / collectionTitle` voor bundeling (100-item demo).
- `ImportJob kind = archive_collection|youtube_playlist` + `preview Json?` + `collectionIdentifier`.

## 2. Seed
`npx tsx src/seed.ts` → **11 subjects, 8 scholars, 15 contents, 1 ImportJob**:
- lectures: youtube single + youtube playlist, archive audio/video, youtube audio
- books: archive, google_books, pdf, external document
- document types + `collectionIdentifier=ilmnet-collection-demo` (4 items delen identifier — bewijs voor collectie-grouping)
- test daarna opgeschoond → terug naar 15 seed-records.

## 3. API — Live op :3001 (Fastify 5.3.2)

### Health
- `GET /api/health` → `{status:ok}` ✅

### Content — filtering / search / pagination
- `GET /api/admin/contents?status=published|draft|archived`, `?type=lecture`, `?provider=archive`, `?q=Qur`, `?scholar=…`, `?subject=…`, `?language=English`, `?page&limit&sort` ✅
- `GET /api/contents` (public)强制 `status=published` ✅
- `GET /api/admin/contents/:id` (ook via slug) ✅
- `POST /api/admin/contents` (ook `/api/contents` & `/api/v1/contents` aliases) — validatie scholarIds/subjectIds exist, slug unique, embedUrl auto-built ✅
  - youtube video → `https://www.youtube.com/embed/<id>`
  - youtube playlist → `https://www.youtube.com/embed/videoseries?list=…`
  - archive → `https://archive.org/embed/<identifier>`
  - google_books (input `google-books` genormaliseerd → `google_books`) → `https://books.google.com/books?id=…&printsec=frontcover`
  - pdf → direct url ✅
- `PATCH /api/admin/contents/:id` — many-to-many update atomisch (deleteMany + createMany) ✅
  - Titel-update → slug regenerated via `uniqueSlug`
  - Provider/sourceUrl wijziging → embedUrl herbouwd
- `DELETE /api/admin/contents/:id?hard=true` → hard delete; zonder `hard` → `status=archived` ✅
- `POST /api/admin/contents/:id/publish` → validatie: titel ≥3, sourceUrl vereist, ≥1 scholar & ≥1 subject; zet `publishedAt=now()` ✅
- `POST /api/admin/contents/:id/unpublish` → `status=draft` ✅
- `PATCH /api/admin/contents/bulk` → bulk status update ✅

**Extended tests**
- Many-to-many: create met 1 scholar/subject → PATCH naar 2 scholars + 2 subjects → GET toont beide ✅
- Public list alleen published (na publish verschijnt item in `/api/contents?q=…`) ✅
- Publish zonder subject → `400 VALIDATION_ERROR At least one subject required` ✅
- Provider normalisatie: `google-books` → DB `google_books` ✅
- `metadata Json` round-trip ✅
- `collectionIdentifier` grouping: 4 items met `ilmnet-collection-demo` + 1 met `ilmnet-history-collection` ✅

### Scholar & Subject
- `GET /api/admin/scholars` (ook `/api/scholars`, `/api/v1/scholars`) ✅
- `POST /api/admin/scholars` → slug + initials auto-generated, specialtyId FK check, status default published ✅
- `PATCH /api/admin/scholars/:id` → slug herberekenen bij naamwijziging ✅
- `DELETE /api/admin/scholars/:id` → 409 conflict indien nog gelinkt aan ContentScholar ✅
- `POST/PATCH/DELETE /api/admin/subjects` idem, met `delete conflict check` ✅

## 4. Frontend-koppeling
- `vite.config.ts` → `proxy: {"/api": "http://localhost:3001"}` → `curl http://localhost:5173/api/health` proxyt correct ✅
- `src/lib/api.ts` nieuw: typed fetch-wrapper, mappers `backendToAdminLecture/Book`, payload-builders, proxy-base `VITE_API_URL`.
- `src/admin/store.tsx` herschreven: hydrate bij mount (`listAdminScholars/Subjects/Contents`), split contents in lectures (`lecture|audio|video`) vs books (`book|document`), optimistic updates met API fallback → lokale seed indien backend offline. Build `tsc` errors gefixt (scholar.ts param type, server.ts unknown error).
- Builds: `server: tsc` ✅, `frontend: vite build` ✅ (568 kB singlefile).
- Live servers: `tsx watch src/server.ts :3001` + `vite --host 0.0.0.0 :5173` (proxy) — beide via `curl` geverifieerd.

## 5. Nog te doen / Next
- Frontend public pagina's (`Lectures.tsx`/`Books.tsx`) optioneel ook live via `listPublishedContents` i.p.v. mock `data.ts` (infrastructuur klaar).
- `ImportJob` bulk endpoint voor Archive.org collectie-import (schema klaar, UI al mock via `mockFetchArchiveCollection`).
- Echte auth voor `/api/admin/*` (nu open voor UI-demo).

---
*Verified 20 Sep 2026 20:32 CEST — DB ilmnet@5432, backend :3001, frontend :5173 proxy OK.*
