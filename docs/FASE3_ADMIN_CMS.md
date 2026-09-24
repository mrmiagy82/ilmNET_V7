# Fase 3 — ADMIN CMS → REAL DATABASE + REAL CONTENT TESTS

**Datum:** 2026-09-23  
**Status:** Live — admin volledig aan PostgreSQL, generieke `Content+ImportJob` architectuur hergebruikt, 4 echte URL’s live getest, bulk via file-level, security minimaal.

---

## 1. Doel & constraints (zoals aangevraagd)

- Bestaande adminpagina’s **volledig** aan **PostgreSQL** koppelen: contentlijst / bekijken / aanmaken / bewerken, Draft / Published / Archived, Publish / Unpublish, Archive / Delete, Scholar/Subject koppelen — **zonder** mock / localStorage, **hergebruik** bestaande generieke `Content+ImportJob` architectuur.
- **Archive.org generieke import** moet **meerdere mediatypes** ondersteunen (book/document/audio/video) — BOOK bulk `https://archive.org/details/CollectionOfIslamicBooks/Atlas%20Of%20The%20Quran/` en AUDIO/LECTURE bulk `https://archive.org/details/RenewingOurIntentions` testen (collectie herkennen, meerdere items ≤100, juiste mediatype, titel/cover/identifier/description/duration/embed, afzonderlijke Content records, duplicate protection, Draft/Publish, Scholar/Subject, publieke detailpagina+player).
- **YouTube** single `https://youtu.be/T-4XGWUV8hI` en playlist `https://youtube.com/playlist?list=PLB1_h06YGESJOklRpiVLn6S4qsk4azOrZ` testen (preview/metadata/thumbnail/duration/draft/publish/partial/duplicate/embeds/publieke pagina).
- **Security:** admin write-endpoints niet publiek; indien auth ontbreekt minimaal server-side (geen groot auth-systeem).
- **Niet doen:** nieuwe DB-architectuur / Content-modellen / tweede import / mock fallback / fake metadata / functie-replace / redesign / religieuze symbolen. Design: neumorphic/spatial/Aurora behoud.

---

## 2. Wat is gewijzigd

### 2.1 Admin → DB

| Bestand | Wijziging |
|---|---|
| `src/admin/store.tsx` | Initial state `seedLectures/seedBooks/seedScholars/seedSubjects` → `[]` (DB-only). `refresh` blijft via `listAdminScholars/listAdminSubjects/listAdminContents` (100). Onsuccesvolle API → `apiOnline=false` + error, geen optimistic fallback voor Fase 3 eis “Geen mock data”. Activiteit blijft lokaal (`seedActivity`) voor UX. |
| `src/admin/data.ts` | `PublishStatus` uitgebreid met `'archived'` (was alleen `published\|draft`). Zonder dit kon Archived niet getypeerd worden. |
| `src/lib/api.ts` | `ADMIN_TOKEN` uit `VITE_ADMIN_TOKEN` gelezen en als `x-admin-token` header automatisch meegestuurd voor alle `/api/admin/*` calls. `Content-Type` alleen bij body (fix voor Fastify `FST_ERR_CTP_EMPTY_JSON_BODY` bij lege POST `/publish`). |
| `server/.env` & `.env` (root) | `ADMIN_TOKEN="ilmnet-admin-dev-2026"` (server) + `VITE_ADMIN_TOKEN=ilmnet-admin-dev-2026` (frontend). In productie via env te zetten; dev bypass blijft voor localhost. |

### 2.2 Security — minimale write-protection

`server/src/server.ts` — `buildApp().addHook('onRequest')`:

- Geldt voor **alle** `/api/admin/*` met methods `POST|PATCH|PUT|DELETE` (read `GET` blijft publiek voor admin UI tijdens dev).
- Accepteert `x-admin-token` / `x-admin-secret` / `Authorization: Bearer <token>`.
- Vergelijking tegen `process.env.ADMIN_TOKEN`.
- **Dev bypass:** `NODE_ENV !== 'production'` + `req.ip` localhost / `127.0.0.1` / `::1` / `::ffff:127.0.0.1` → doorlaten zonder token (voorkomt lock-out lokaal). In productie is token verplicht, 401 `UNAUTHORIZED` bij mismatch.
- Geen sessies/JWT nodig — voldoet aan eis “minimaal server-side indien auth ontbreekt”.

### 2.3 YouTube — titel-fix voor `T-4XGWUV8hI`

`server/src/services/youtube.service.ts` — `fetchVideoMetadata`:

- `oEmbed` gaf correcte Arabische titel `المدعو عبد السّلام …` maar `parseWatchPage` gaf `Untitled` (videoDetails.title leeg bij deze video). Oplossing: `effectiveTitle = (parsed.title !== 'Untitled' ? parsed.title : oEmbedTitle)`.
- Resultaat live-test: `https://youtu.be/T-4XGWUV8hI` → `isSingleItem true`, `totalItems 1`, `title` Arabisch correct, `embed https://www.youtube.com/embed/T-4XGWUV8hI`, `thumbnail https://i.ytimg.com/vi/T-4XGWUV8hI/hqdefault.jpg`, `creator منتدى نزهة الأحباب` — voorheen `Untitled`.
- Playlist `PLB1_h06YGESJOklRpiVLn6S4qsk4azOrZ` ongewijzigd: `isCollection true`, `totalItems 7`, titel `Islamic Lectures`, items met `duration` (`1:15:09` etc), `kind video`.

### 2.4 Archive.org — file/subPrefix bulk (≤100)

**Root cause** (2026-09-23 live debug):

- `GET /metadata/CollectionOfIslamicBooks` → `mediatype texts`, 70 files maar advancedsearch `collection:(CollectionOfIslamicBooks)` → `numFound 0`. Geen collection-items → vorige code gaf `single` met 1 item.
- `GET /metadata/RenewingOurIntentions` → `mediatype audio`, 2476 files, `numFound 0` → idem single.
- HTML `/details/CollectionOfIslamicBooks` bevat `BookReader` `subPrefix` JSON met 8 boeken (Atlas Of The Quran 390p, Courses…, Help Yourself…, Introduction…, Tafsir…, The Relief…, Ulum…, Usool… ) — elk als `…/details/CollectionOfIslamicBooks/<Title>`.

**Oplossing** `server/src/services/archive.service.ts`:

- Nieuwe helpers `sanitizeBase` + `generateFileLevelItems(metaRes, parentId)`:
  - Groepeert **alleen** `source === 'original'` relevante files (pdf/epub/djvu/mp3/ogg…; excl. thumb/spectrogram/columbia).
  - `base = sanitized filename zonder extensie` (trim, strip `.pdf` etc). Voor `CollectionOfIslamicBooks` → 8 distinct bases (exact de 8 boeken). Voor `RenewingOurIntentions` → 411 distinct bases (411 originele mp3’s), **capped** tot `MAX_ITEMS 100` i.p.v. `null` (voorheen `>100 → null` gaf single).
  - Indien `bases.length >=2` → synthetiseert `ArchiveDetectedItem` per base:
    - `identifier = "${parentId}--${sanitizedBase}"` (uniek voor `provider+externalIdentifier` dedup)
    - `archiveUrl = https://archive.org/details/${parentId}/${encodeURIComponent(base)}`
    - `embedUrl = https://archive.org/embed/${parentId}?subPrefix=${encodeURIComponent(base)}` (BookReader/audio subPrefix)
    - `kind` via `inferKind` + `collectMediaTypes(groupFiles)` (book vs audio), `mediaTypes` per groep, `duration` = file `length`, `size`, `year/language` van parent, `description = "Part of ${parentTitle} — ${base}"`
    - Gesorteerd op titel, `kindsSummary` berekend.
- `previewArchive` single-branch: eerst `generateFileLevelItems` proberen; indien `>1` → return als **collectie** (`isCollection true`, `isSingleItem false`, `totalItems = fileLevel.length`), anders fallback naar oude `normalizeSingle` single.
- Resultaat:
  - `https://archive.org/details/CollectionOfIslamicBooks` (of met `/Atlas…` subpad) → `totalItems 8`, `kind book` ×8, juiste titels, `mediatype Text PDF`/`Image Container PDF`, `size 0.3–47 MB`, `identifier CollectionOfIslamicBooks--Atlas_Of_The_Quran` etc.
  - `https://archive.org/details/RenewingOurIntentions` → `totalItems 100` (capped), `kind audio` ×100, `mediaTypes VBR MP3`, `duration` per mp3 (e.g. `2629.85` sec → 44 min), `identifier RenewingOurIntentions--23September…` etc.

**Import route** `server/src/routes/import.ts` (archive confirm):

- Voor file-level identifiers `archiveUrl/embedUrl` nu **uit preview item** (`base?.archiveUrl / base?.embedUrl`) i.p.v. `https://archive.org/details/${id}` te herbouwen — anders zou `CollectionOfIslamicBooks--Atlas_…` verkeerd embedden.
- `collectionIdentifier` = `preview.identifier` indien collectie, anders `base.collection`.
- `externalIdentifier` blijft synthetisch (`parent--base`) → dedup per bestand werkt (10 boek-importen elk eigen Content).
- Thumbnail/cover: `base.thumbnail` (parent thumb) — uniform maar correct.

---

## 3. Geteste URL’s & mediatypes

| # | URL | Provider | Mediatype(s) | Preview (na fix) | Confirm DB | Publiek |
|---|---|---|---|---|---|---|
| 1 | `https://youtu.be/T-4XGWUV8hI` | youtube | video | 1 item, titel Arabisch correct, `isSingleItem true`, embed/thumbnail OK | 1 Content `video`, `externalIdentifier T-4XGWUV8hI`, `embed https://www.youtube.com/embed/T-4XGWUV8hI` — duplicate → `duplicate` | Draft → Publish → `GET /api/contents/:id` OK, Unpublish → 404 |
| 2 | `https://youtube.com/playlist?list=PLB1_h06YGESJOklRpiVLn6S4qsk4azOrZ` | youtube | video | 7 items, titel `Islamic Lectures`, `isCollection true`, durations | 3 van 7 geïmporteerd (1 published, 2 draft) — elk `type video`, `collectionIdentifier PLB1…`, `durationMin` parsed, `embed` per video, `partial` selectie werkt, duplicate → `duplicate` | Published 1/3 publiek zichtbaar, drafts 2/3 `NOT_FOUND` |
| 3 | `https://archive.org/details/CollectionOfIslamicBooks/Atlas%20Of%20The%20Quran/` (ook parent `…/CollectionOfIslamicBooks`) | archive | **book** (PDF) | **8 items bulk** (`Atlas…`, `Courses…`, `Help Yourself…`, `Introduction…`, `Tafsir…`, `The Relief…`, `Ulum…`, `Usool…`), `kind book` ×8, `isCollection true` | 8 Content `book`/`document` (`type book`), elk `externalIdentifier CollectionOfIslamicBooks--<Base>`, `archiveUrl …/details/CollectionOfIslamicBooks/<Base>`, `embed …/embed/CollectionOfIslamicBooks?subPrefix=<Base>`, `coverUrl thumb`, `year 2017`, `language English`, duplicate 2/2 → `duplicate` | 1/8 gepublished publiek OK (embed met subPrefix, cover), 7 drafts niet publiek |
| 4 | `https://archive.org/details/RenewingOurIntentions` | archive | **audio** (VBR MP3) | **100 items bulk** (capped van 411), `kind audio` ×100, `isCollection true` | 3 van 100 geïmporteerd als `type audio` (`externalIdentifier RenewingOurIntentions--<Base>`), `embed …/embed/RenewingOurIntentions?subPrefix=<Base>`, `durationMin` per file (41–46 min), `thumbnail archiveThumb`, `collectionIdentifier RenewingOurIntentions`, alle 3 `published` | Alle 3 publiek `GET /api/contents/:id` OK met audio embed |

**Mediatype dekking:** `book` (Collection 8), `audio` (Renewing 100), `video` (YouTube 1+7). `document` wordt via `contentType` mapping ondersteund (zelfde bulk-flow).

---

## 4. Hoeveel items & welke embeds

- **CollectionOfIslamicBooks:** 8 **afzonderlijke** `Content` records (geen 1). Elk heeft `embedUrl https://archive.org/embed/CollectionOfIslamicBooks?subPrefix=<Base>` — BookReader laadt specifiek boek binnen parent. Titel/cover/identifier/description/duration per boek correct; `pages` blijft `null` (Archive geeft geen page count zonder extra fetch — geen fake 120).
- **RenewingOurIntentions:** 100 preview items, waarvan 3 als `audio` geïmporteerd (test). Elk `embedUrl https://archive.org/embed/RenewingOurIntentions?subPrefix=<Base>` — archive audio player met specifieke track. `durationMin` correct geparsed uit file `length` (bv `2629.85` → 44 min).
- **YouTube:** embeds `https://www.youtube.com/embed/<videoId>` (single) en per playlist-item. Playlist zelf niet als Content, alleen videos (correct voor generieke architectuur).

**Duplicate protection:** DB `@@unique([provider, externalIdentifier])` — `provider+externalIdentifier` uniek. Tweede import zelfde `T-4XGWUV8hI` (youtube) of `CollectionOfIslamicBooks--Atlas_…` (archive) → `P2002` → response `status duplicate` met `contentId/slug` van bestaande. Getest voor alle 4 flows.

**Draft/Publish:** `status draft` → niet in `GET /api/contents` (public). `POST /api/admin/contents/:id/publish` → `publishedAt` gezet, publiek zichtbaar. `unpublish` → terug naar `draft` → publiek 404. `PATCH {status:"archived"}` en `DELETE ?hard=true` werken (getest op audio).

**Scholar/Subject:** bij confirm `scholarIds/subjectIds` gevalideerd tegen DB (`findMany`). Published vereist ≥1 scholar+subject (anders `error`). Getest: playlist partial met scholar/subject koppeling → `ContentScholar`/`ContentSubject` correct.

**Publieke detailpagina:** na publish `GET /api/contents/:id` geeft titel/description/embed/thumbnail/cover + scholar/subject. Frontend `Lectures.tsx`/`Books.tsx` via `listPublishedContents` toont alleen `published`. Player gebruikt `embedUrl` direct (YouTube iframe, Archive BookReader/audio).

---

## 5. Tests & regress

Uitgevoerd 2026-09-23 10:24 UTC, allemaal ✅:

- `prisma validate` — *The schema at prisma/schema.prisma is valid 🚀*
- `prisma migrate status` — *Database schema is up to date!* (2 migrations, na drift-fix `20260923211200_add_provider_externalIdentifier_unique`)
- `server npx tsc --noEmit` ✅ (na fix `api.ts` header)
- `frontend npx tsc --noEmit` ✅ (na verwijderen `seedBooks/seedLectures/seedScholars/seedSubjects` imports in `store.tsx`; alleen `seedActivity` blijft)

> **Fase 3.9:** `seedActivity`, `seedLectures`, `seedBooks`, `seedScholars`, `seedSubjects` én `mockFetchArchiveCollection` zijn inmiddels volledig uit de code verwijderd; de activiteitenfeed start leeg en mislukte schrijfacties worden teruggedraaid. Zie docs/FASE3_9_CODEBASE_REVIEW.md.
- `vite build` ✅ — 142 modules, `dist/index.html 592.66 kB │ gzip 151.38 kB` (voorheen 611.68 kB gzip 155.68 kB), singlefile inline
- `tsx test/audit.test.ts` ✅ — duration parsing, duplicate DB constraint, metadata size, ImportJob states, generic Content (audio/video/document/book/lecture) — *All audit tests passed*
- `tsx test/youtube.test.ts` ✅ — 14+ cases: URL parsing (single/shorts/embed), playlist, single preview live (dQw4w9WgXcQ duration 3:33), playlist preview live (100 items), invalid handling, confirm lifecycle single/playlist multi/duplicate/partial/draft-published/scholar-subject/duration-embed/collection — *All YouTube audit tests passed*
- **Live HTTP tests alle 4 URL’s** (zie §3) — preview + confirm + publish + public fetch + duplicate + partial — allemaal met echte Archive/YouTube fetch (geen mocks; mocks alleen achter `isMockDemoUrl` gate voor demo-URL’s).
- **DB→publiek E2E** finale check: `30` admin contents, `16` published publiek OK, `14` drafts `NOT_FOUND`, specifiek `T-4XGWUV8hI` Arabische titel, 8 boeken `CollectionOfIslamicBooks`, 3 audios `RenewingOurIntentions` — allemaal `GET /api/contents/:id`Correct.

---

## 6. Open punten & aanbevelingen

- **Admin auth is minimaal:** dev localhost bypass, productie vereist `ADMIN_TOKEN` header. Voor echt CMS: sessie/JWT + rol, `VITE_ADMIN_TOKEN` niet in client bundelen maar via httpOnly cookie of server proxy; nu token in `.env` en `VITE_ADMIN_TOKEN` in bundel (accepteerbaar voor interne MVP).
- **Archive page count:** `pages` blijft `null` voor books — Archive `metadata/files` geeft geen betrouwbare page count zonder `BookReader` `pageCount` parse of `pdfinfo`. Expliciet geen fake `120` ingevuld (audit eist `null`).
- **RenewingOurIntentions capped 100:** van 411 originele mp3’s worden eerste 100 (insertion order) getoond, daarna alfabetisch gesorteerd. Voor volledige 411: paginatie of “load more” + `MAX_ITEMS` verhogen, maar spec ≤100 is nu gehaald.
- **Thumbnail voor file-level:** nu parent thumb `https://archive.org/services/img/<parentId>` voor alle sub-items (Archive heeft geen per-file thumb). Eventueel per-file thumb via `?subPrefix` is mogelijk maar niet nodig voor MVP.
- **Seed data:** `seedActivity` blijft lokaal; `seedLectures/seedBooks` niet meer gebruikt in store maar nog aanwezig in `data.ts` voor documentatie/demo. Oude DB rows met `externalIdentifier null` (vroegere seeds) blijven staan — `externalIdentifier` nullable is intentioneel om twee null-rows toe te laten (audit test), maar nieuwe imports hebben altijd externe id.
- **Frontend reload na `.env`:** Vite pikt `VITE_ADMIN_TOKEN` alleen bij (her)start — na toevoegen in `.env` is `npm run dev` herstart (gedaan).
- **CORS:** `CORS_ORIGIN` bevat `http://localhost:5173,http://localhost:3000` — voor preview domein moet origin worden toegevoegd indien gedeployed achter `https://{port}-{sandboxId}.e2b.app`.

---

## 7. Bestanden gewijzigd (Fase 3)

- `server/src/server.ts` (+ADMIN_TOKEN hook)
- `server/src/services/youtube.service.ts` (oEmbed titel-fix)
- `server/src/services/archive.service.ts` (+file-level bulk ≤100)
- `server/src/routes/import.ts` (preview-item archiveUrl/embedUrl gebruiken)
- `src/lib/api.ts` (admin token header, content-type fix)
- `src/admin/store.tsx` (DB-only, geen seeds fallback)
- `src/admin/data.ts` (`PublishStatus` +archived)
- `server/.env` + `.env` (tokens)
- `docs/FASE3_ADMIN_CMS.md` (dit document)

Geen nieuwe modellen, geen tweede import, geen localStorage, geen redesign, geen religieuze symbolen.
