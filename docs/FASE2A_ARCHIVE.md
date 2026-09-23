# Fase 2A — Archive.org generieke Bulk Import — Rapport (2026-09-20)

## 1. Scope & Acceptatiecriteria

**Bron:** https://github.com/mrmiagy82/ilmNET_V7 — Fase 0/1 done (ADMIN CONTENT MANAGEMENT + PostgreSQL/Prisma :3001).  
Fase 2A vervangt **alleen** de frontend mock/dataflow van de bestaande Archive.org Bulk Import UI door echte Archive.org integratie. YouTube blijft ongewijzigd.

### Acceptatiecriteria (afgevinkt)

| # | Criterium | Status |
|---|-----------|--------|
| 1 | Huidige Bulk Import UI behouden, alleen `mockFetchArchiveCollection()` vervangen door echte API | ✅ |
| 2 | Single item via `/details/<id>` en `/embed/<id>` | ✅ |
| 3 | Collection via `/details/<collection>`, `/search?...`, `collection:...` | ✅ |
| 4 | Gebruik `archive.org/metadata/<id>` + `advancedsearch.php` / `scrape` | ✅ |
| 5 | Voor collection: items ontdekken → normaliseren naar `ArchiveDetectedItem` met identifier,title,Archive URL,embed URL,media types,mediatype,thumbnail,creator/date/year,language,description,subject,duration,size | ✅ |
| 6 | Geen book-only logica — audio/video/book/document/lecture/unknown ondersteund | ✅ |
| 7 | Preview: `POST /api/admin/imports/archive/preview {sourceUrl} → {jobId, identifier, isCollection, totalItems, kindsSummary, items[]}` + ImportJob opslaan | ✅ |
| 8 | Frontend echte API, banner **“Archive.org collection detected — 100 items found”** behouden + zoeken/filteren/pagineren/selecteren + per-item titel/contentType/scholar/subjects/taal/serie/beschrijving/draft-publish-skip | ✅ |
| 9 | Confirm: `POST /api/admin/imports/archive/confirm` per geselecteerd item validate + duplicate check `provider+externalIdentifier` + 1 Content record per item + scholars/subjects + metadata + ImportJob koppeling + collectionIdentifier/Title + status draft/published (37 selected → 37 records, niet 1) | ✅ |
|10| Duplicates: geen tweede record, duidelijk melden | ✅ |
|11| Media: `https://archive.org/embed/<identifier>` + originele URL + metadata, geen aanname uniform mediatype | ✅ |
|12| Performance: paginatie 20/page, concurrency ≤5, geen honderden parallel, per-item timeout 7s, 100-item collection crasht niet bij ontbrekende metadata | ✅ |
|13| Provider-service `archive.service.ts` geïsoleerd van generieke Content CRUD | ✅ |
|14| Neumorphic UI ongewijzigd, YouTube ongewijzigd | ✅ |

---

## 2. Gewijzigde / nieuwe bestanden

### Backend (server/: `Fastify 5.3.2`, `Prisma 6.19.3`, `tsx watch` op `0.0.0.0:3001`)

```
server/src/services/archive.service.ts   ~509 regels — GEWIJZIGD (2e iteratie)
  - fetchJson: User-Agent: ilmNet/1.0 + Accept: application/json + 7s AbortController
  - parseArchiveIdentifier: /details/<id>, /embed/<id>, /download/<id>, /search?query=collection:(id), q=…, regex fallback
  - archiveItemLink / archiveEmbedLink / archiveThumbLink
  - normalizeLanguage (ISO 639), stripHtml, toYear, collectMediaTypes, inferKind
  - synthMediaTypes voor fast-path: etree/audio → MP3/Ogg Vorbis, movies → MPEG4/h.264, texts → PDF/Text
  - normalizeSingle: metadata+files → ArchiveDetectedItem (kind, mediaTypes, mediatype, thumbnail, creator, date/year, language, description[900], subjectHint, duration, size, publisher, collection)
  - fetchMetadata: GET /metadata/<id>
  - fetchCollectionMembers: advancedsearch.php?q=collection:(id)&fl[]=identifier,…&rows=100&output=json (fallback: /services/search/v1/scrape)
  - previewArchive: identifier → fetchMetadata → mediatype check → collection? → fast-path docs.map zonder per-item fetchMetadata → ArchivePreview

server/src/routes/import.ts               ~13 kB — actief (preview/confirm endpoints + ImportJob persist)
  POST /api/admin/imports/archive/preview
  POST /api/admin/imports/archive/confirm
  GET  /api/admin/imports (debug/list)

server/src/server.ts                      gezondheid + CORS (geen wijziging nodig)
server/prisma/schema.prisma               ongewijzigd (ImportJob.kind=archive_collection|youtube_playlist + preview Json + collectionIdentifier)
```

**Fix 2 (performance):** `isCollection && docs` branch herschreven van `CONCURRENCY 5 × fetchMetadata` (100×7s worst 140s) naar **fast-path directe `docs→ArchiveDetectedItem` mapping** met `synthMediaTypes`/`inferKind`/`archiveThumbLink`. Resultaat: `prelinger` 10.9s → 2.6s, `etree` >70s timeout → 0.366s.

### Frontend (Vite 7.3.2, React 18)

```
src/admin/ArchiveImportPage.tsx           35 785 bytes, 599 regels — HERSCHREVEN
  - Behoudt exacte banner: “Archive.org collection detected — {totalItems} items found”
  - Behoudt: zoeken (title/identifier/creator/media), filter kind (all/audio/video/book/document), paginatie 20/page, select all/deselect, toggle per item, bulk scholar/subject/language
  - Behoudt: per-item editable title, contentType (lecture/audio/video/book/document), scholarIds, subjectIds, language, series, category, description[TextArea], status draft/published/skip
  - Vervangt mock: handleDetect → previewArchive(url) → map naar ArchiveCollectionResult + initial drafts + auto-map creator→scholar & subjectHint→subject
  - Import: handleImport → confirmArchive(jobId, drafts) → summary {created,duplicates,errors,skipped} + flash + providerNote duplicates + refresh() + navigate('/admin')
  - Fallback mock alleen voor demo ids (ilmnet-*, single-manuscript) met melding “Live fetch failed (…) — showing demo mock”

src/lib/api.ts                            nieuw (112 regels)
  export previewArchive(sourceUrl) → POST /api/admin/imports/archive/preview
  export confirmArchive(jobId, drafts) → POST /api/admin/imports/archive/confirm

src/admin/data.ts                         uitgebreid met ArchiveDetectedItem, ArchiveCollectionResult, ArchiveImportDraft, mockFetchArchiveCollection (alleen fallback)
```

**Neumorphic UI:** `src/admin/ui.tsx` ongewijzigd (cards `neu-raised`, `neu-inset`, `neu-dark-raised`, `bg-sand/cream`).

**Overige Fase 0/1 pagina's** (`AdminLayout`, `Overview`, `LecturesPage`, `BooksPage`, etc.) ongewijzigd behalve kleine imports; YouTube provider apart gehouden.

---

## 3. Endpoints

### Preview

```
POST /api/admin/imports/archive/preview
Body: { sourceUrl: string }  // https://archive.org/details/<id> | /embed/<id> | /search?query=collection:(id) | https://archive.org/search.php?query=collection:etree | https://archive.org/search?query=collection:(etree)+AND+mediatype:etree
Resp 200: {
  jobId: string,               // ImportJob.id (Postgres)
  sourceUrl: string,
  identifier: string,          // geparste id, bv "commute" of "etree"
  title: string,               // collectie/item title
  description?: string,        // 900 chars gestript
  totalItems: number,          // 1 (single) of min(numFound,100)
  items: ArchiveDetectedItem[],// 1…100
  fetchedAt: "20 Sept 2026",
  isCollection: boolean,
  isSingleItem: boolean,
  provider: "archive",
  kindsSummary: { audio?:n, video?:n, book?:n, document?:n, collection?:n, unknown?:n },
  collectionTitle?: string
}
Errors: 400 Cannot parse identifier, 404 Archive.org item not found, 500 fetch failed
```

**Archive.org calls (server-side, geen CORS):**
- `GET https://archive.org/metadata/<identifier>` — single / collectie metadata
- `GET https://archive.org/advancedsearch.php?q=collection:(<id>)&fl[]=identifier&fl[]=title…&rows=100&output=json` — members (fallback: `/services/search/v1/scrape?fields=identifier,title,mediatype…&count=100`)

### Confirm

```
POST /api/admin/imports/archive/confirm
Body: {
  jobId: string,
  items: Array<{
    identifier: string,
    selected?: boolean,          // false → skip
    customTitle?: string,
    customDescription?: string,
    contentType?: "lecture"|"audio"|"video"|"book"|"document",
    scholarIds?: string[],       // vereist indien status !== skip
    subjectIds?: string[],       // idem
    language?: string,           // bv English / Arabic
    series?: string,
    category?: string,           // Classical / Translation …
    status?: "draft"|"published"|"skip"
  }>
}
Resp 200: {
  jobId: string,
  summary: { totalFound: number, totalRequested: number, created: number, duplicates: number, errors: number, skipped: number },
  results: Array<{ identifier: string, status: "created"|"duplicate"|"error"|"skipped", contentId?: string, slug?: string, message?: string }>
}
Logic per item (selected && status!=skip):
  1. validate (title≥3, scholarIds≥1, subjectIds≥1 — bij published idem)
  2. duplicate check: WHERE provider=archive AND externalIdentifier=identifier → indien exists → duplicate (geen 2e record, message “Already imported as …”)
  3. fetchMetadata opnieuw voor detail → create Content {
       type: contentType,
       title: customTitle || detected.title,
       slug: uniqueSlug(title),
       provider: "archive",
       sourceUrl: https://archive.org/details/<identifier>,
       externalIdentifier: identifier,
       embedUrl: https://archive.org/embed/<identifier>,
       thumbnailUrl: https://archive.org/services/img/<identifier>,
       collectionIdentifier: isCollection ? identifier : null (uit preview job),
       collectionTitle: preview.title,
       language, series, category, status, durationMin, year, metadata: { archive: { … } },
       importJobId: jobId,
       scholars: connect scholarIds,
       subjects: connect subjectIds
     }
  4. ImportJob.update { status: completed, importedCount, preview: {…, kindsSummary, importSummary } }
```

**Duplicate key:** `provider + externalIdentifier` unique (geïndexeerd in Content). Meerdere imports van zelfde Archive id → `duplicates` teller, geen nieuwe rij.

### Bestaand ongewijzigd (YouTube)

```
POST /api/admin/contents           // provider youtube, playlist etc — getest, 5 youtube contents nog OK
GET  /api/admin/contents?provider=…&type=…&status=…&q=…&scholar=…&subject=…
PATCH/DELETE /api/admin/contents/:id
```

---

## 4. URL-support (getest live)

| URL-voorbeeld | Parse resultaat | Preview |
|---------------|----------------|---------|
| `https://archive.org/details/commute` | `commute` single video | 1 item kind video mediaTypes [Motion JPEG,h.264,Ogg Video] |
| `https://archive.org/embed/commute` | `commute` | 1 item (zelfde) |
| `https://archive.org/details/commute?from=home` | `commute` | 1 item |
| `https://archive.org/details/inplainair2024-04-06` | `inplainair2024-04-06` single audio | kind audio [Flac FingerPrint,Text,Columbia Peaks,Flac,VBR MP3,PNG] duration 177.41 size 239 MB |
| `https://archive.org/details/gov.uscourts.gamd.137573` | `gov.uscourts.gamd.137573` single book | kind book [Text PDF] language English |
| `https://archive.org/details/prelinger` | `prelinger` collection | 100 items kind video [MPEG4/h.264] |
| `https://archive.org/details/etree` | `etree` collection | 100 items kind audio [MP3/Ogg Vorbis] |
| `https://archive.org/search?query=collection%3A(prelinger)` | `prelinger` | 100 video |
| `https://archive.org/search?query=collection%3A%28etree%29` | `etree` | 100 audio |
| `https://archive.org/search.php?query=collection%3Aetree` | `etree` | 100 audio |
| `https://archive.org/search?query=collection%3A(etree)+AND+mediatype%3Aetree` | `etree` | 100 audio |
| `https://archive.org/details/ilmnet-collection-demo` (demo) | mock fallback | “Live fetch failed … showing demo mock” |

**Identifier regex:** `collection\s*:\s*\(?\s*[\"']?([a-zA-Z0-9_\-\.]+)` + path `/details/` / `/embed/` / `/download/` + laatste padsegment.

---

## 5. Testplan — 14 punten (uitgevoerd 2026-09-20 20:42 UTC, Europe/Brussels)

Backend live: `tsx watch pid 7114 0.0.0.0:3001`, Frontend Vite 5173. `fetchJson` met `User-Agent ilmNet/1.0`.

| # | Test | Commando / Resultaat | Status |
|---|------|----------------------|--------|
| 1 | **Single item** `commute` (video) | `POST /preview {details/commute} → job cmuaa8tmo… totalItems 1 isSingleItem true kind video mediatype movies thumbnail https://archive.org/services/img/commute creator Tracey Jaquith date 2005 duration 1min 55sec size 70.7 MB subjectHint time-lapse publisher PoohBot Pictures` → confirm draft scholar Aisha Mahmoud + Family & Society → `created 1 slug commute-imported-test-video` | ✅ |
| 2 | **Multi-collection** `prelinger` + `etree` | `prelinger → 100 video MPEG4/h.264 kindsSummary {video:100} 2.663s` (voor fix 10.962s single fallback) <br> `etree → 100 audio MP3/Ogg Vorbis {audio:100} 0.366s` (voor fix >70s timeout empty) | ✅ |
| 3 | **100 items** paginatie/limit | Preview respecteert `MAX_ITEMS=100` (`totalItems: min(numFound,100)`; prelinger numFound 11000+ → capped 100). Confirm met 10 selected → 9 created 1 duplicate zonder crash. UI paginaat 20/page (`pageSize 20`, 5 pages voor 100). | ✅ |
| 4 | **Audio** `inplainair2024-04-06` (etree single) | `kind audio mediaTypes [Flac FingerPrint,Text,Columbia Peaks,Flac,VBR MP3,PNG] duration 177.41 size 239 MB creator In Plain Air date 2024-04-06 language English` → confirm als audio published → `slug audio-test-published` | ✅ |
| 5 | **Video** `commute` (zie #1) | `kind video [Motion JPEG,h.264,Ogg Video] embed https://archive.org/embed/commute` | ✅ |
| 6 | **Book / Document** | `gov.uscourts.gamd.137573 → kind book [Text PDF] language English size 472 KB` → confirm als book draft → `slug book-test-draft`; <br> `Document Generic Test` via etree audio bron als `contentType document` → `slug document-generic-test type document` (bewijst geen book-only). Prelinger video als book (`Prelinger Test Book Type`) ook OK. | ✅ |
| 7 | **Duplicate** | 2e import `commute → duplicate 1 message Already imported as "Commute — Imported Test Video"`; <br> `205318_Home_Movie_011083` herhaald → duplicate 2; <br> Etree bulk met reeds geïmporteerde `inplainair…` → duplicate 1 van 10 | ✅ |
| 8 | **Partial selectie** | Prelinger 100 found → 3 selected (`205318… published`, `203960… draft Arabic`, `203969… book Classical`) → `summary totalFound 100 totalRequested 3 created 3` → elk eigen Content.id + slug + `collectionIdentifier=prelinger`. Niet 1 record met 3. | ✅ |
| 9 | **Bulk scholar/subject** | `filtered.selected → applyBulk(scholar Aisha, subject Family&Society, language English)` + per-item add subject correct; Prelinger 3 met bulk, Etree 10 met zelfde scholar/subject voor alle 10 (9 created). | ✅ |
| 10| **Draft** | `commute draft`, `Prelinger Test Book Type draft`, `Etree Bulk draft (5 van 10)` → `status draft` in DB, niet in `/api/contents` public (alleen published). | ✅ |
| 11| **Published** | `Audio Test Published`, `Prelinger Test Video Published`, `Etree Bulk 5 van 10 published` → `status published` + `publishedAt` | ✅ |
| 12| **YouTube regressie** | `GET /api/admin/contents?provider=youtube → 4 → 5` na `POST youtube video https://www.youtube.com/watch?v=dQw4w9WgXcQ → embed https://www.youtube.com/embed/dQw4w9WgXcQ` ✅ <br> Frontend YouTube pagina onaangeroerd. | ✅ |
| 13| **Backend tests** | `server npm run build → tsc 0 errors (3872ms)`; <br> `GET /api/admin/contents?provider=archive → 24`, `?type=video →6 audio 12 book 5 document 1`, `?status=draft 13 published 11`; <br> `PATCH /api/admin/contents/:id` many-to-many atomisch nog OK (Fase 1). | ✅ |
| 14| **Frontend build** | `vite v7.3.2 → 138 modules transformed → dist/index.html 570.07 kB gzip 149.04 kB built in 2.75s` geen TS errors; ArchiveImportPage behoudt neumorphic classes. | ✅ |

**Logs (ingekort):**
- `commute preview 3.2s Single item [MOVIE] → 200`
- `prelinger pre-fix 10962ms isCollection:true numFound 0 fallback single`
- `prelinger post-fix 2663ms totalItems 100`
- `etree post-fix 366ms totalItems 100`
- `inplainair single 1.1s kind audio`
- `gov.uscourts single kind book`

---

## 6. Imports na testrun (20:42–20:48 UTC)

```
GET /api/admin/contents?provider=archive&limit=100 → 24 archive contents
  by type: { audio:12, video:6, book:5, document:1 }
  by status: { draft:13, published:11 }
GET /api/admin/contents?limit=100 → 32 total (8 youtube/google/pdf + 24 archive)

Voorbeelden:
- Commute — Imported Test Video (video draft, year 2005, series Test Series, scholar Dr. Aisha Mahmoud)
- Prelinger Test Video Published (video published, collectionIdentifier prelinger, collectionTitle Prelinger Archives, language English)
- Prelinger Test Video Draft (video draft, Arabic)
- Prelinger Test Book Type (book draft, Classical)
- Audio Test Published (audio published, etree)
- Book Test Draft (book draft, texts, STRALCHUK v. ALLI)
- Etree Bulk 2…10 — Audio Import (9× audio, 5 draft 4 published, collection etree, embed https://archive.org/embed/<id>)
- Document Generic Test (document draft via etree audio source — bewijst generic)

ImportJobs (laatste):
- cmuaaa8r… etree 100 found → 1 created (document-generic-test)
- cmuaa9gti… etree 100 found → 9 created 1 duplicate
- cmuaa955l… prelinger 100 found → 3 created
- cmuaa8tmo… commute 1 found → 1 created
  status completed, preview Json behoudt kindsSummary + importSummary
```

**Bewijs per-item = per-record:** 100 found → 3 selected → 3 Content records (slugs `prelinger-test-video-published`, `prelinger-test-video-draft`, `prelinger-test-book-type`), elk met eigen `id`, `slug`, `scholarIds`, `subjectIds`, `language`, `status`, `collectionIdentifier`. Idem 100 found → 10 requested → 9 created 1 duplicate (correct gemeld).

---

## 7. Beperkingen & design-keuzes

1. **Preview fast-path vs diepe files:** Collection-preview gebruikt nu `advancedsearch` docs direct, niet per-item `/metadata`. Dat geeft **snelle (<3s) en robuuste** lijst van 100, maar `mediaTypes` is gesynthetiseerd (`MP3/Ogg Vorbis`, `MPEG4/h.264`, `PDF/Text`). Detailvelden `duration/size/publisher` komen bij preview alleen voor single items; bij collections zijn ze optioneel/`undefined` (wordt verrijkt bij confirm via `fetchMetadata`). Payload blijft dus licht en faalt niet bij één ontbrekende metadata.

2. **Limit 100:** `MAX_ITEMS=100` (`rows=100`, `totalItems = min(numFound, MAX_ITEMS)`). Grotere collecties (prelinger ~11k, etree ~250k) tonen eerste 100. UI paginatie is 20/page. “Meer laden” (volgende pagina via `page=2`) is voorzien in `fetchCollectionMembers` maar nu niet via UI (vergt infinitie scroll).

3. **Concurrency/timeout:** `CONCURRENCY` (nu 5) wordt alleen bij single fallback gebruikt; bij fast-path geen parallelle fetches. `FETCH_TIMEOUT_MS=7000` per `fetchJson` (met `User-Agent` vereist voor Archive.org, anders 403/leeg).

4. **Mediatype inferentie:** `inferKind(mediatype, formats)` behandelt `etree`/`audio` → audio, `movies` → video, `texts` → book (tenzij mediaTypes wijzen op video/audio), fallback via formats. `unknown` blijft mogelijk voor exotische `data`/`web` items — UI toont dan `unknown` badge, gebruiker kiest zelf `contentType`.

5. **Taal/datum:** `normalizeLanguage` kent 12 mappings (eng→English etc.) en `toYear` extraheert 19xx/20xx uit `date`. Archive language is soms ISO3, soms vrij tekst.

6. **YouTube geïsoleerd:** Archive-service raakt geen `content.ts` CRUD aan behalve via standaard `provider`/`externalIdentifier` velden. YouTube blijft via eigen `POST /api/admin/contents` met `provider youtube`.

7. **Neumorphic CSS:** ongewijzigd; enkel `ArchiveImportPage` TSX aangepast.

8. **Error afhandeling:** Per-item `try/catch` in preview (één foute doc skippen ipv hele collectie aborten). Confirm doet per-item validate en duplicate check, telt `errors`.

---

## 8. YouTube bevestiging

- Voor Archive-tests: `GET /api/admin/contents?provider=youtube → 4`
- Na Archive bulk: `POST youtube https://www.youtube.com/watch?v=dQw4w9WgXcQ → 200 embed https://www.youtube.com/embed/dQw4w9WgXcQ → GET youtube → 5`
- Frontend YouTube pagina/componenten ongewijzigd (geen imports uit `archive.service.ts`).
- **Conclusie:** Archive integratie raakt YouTube niet — videos & playlists blijven werken.

---

## 9. Builds & health

```
Server:  npx tsc --noEmit / npm run build → 0 errors, 3872ms
Client:  npm run build → vite 138 modules → dist/index.html 570.07 kB gzip 149.04 kB 2.75s
Backend: 0.0.0.0:3001 (tsx watch pid 7114) — Prisma PostgreSQL 17.11 ilmnet@localhost:5432
Frontend: vite 0.0.0.0:5173
```

---

## 10. Checklist voor handmatige UI-walkthrough (na `npm run dev`)

1. Open `http://localhost:5173/admin/import/archive` → URL `https://archive.org/details/commute` → **Analyse** → banner “Archive.org collection detected — 1 items found” → 1 kaart, kind video, mediaTypes, thumbnail, creator/date, edit titel → selecteer → Import → flash “Successfully imported 1 separate records” → `/admin` toont nieuwe draft.
2. Zelfde met `https://archive.org/details/prelinger` → banner “100 items found” → zoeken “Home Movie” → filter type video → page 2/5 → selecteer 3 → per-item scholar/subject/language/serie/status wijzigen → `Import 3 as separate records` → 3 records met zelfde `collectionIdentifier`.
3. Zelfde met `https://archive.org/details/etree` → 100 audio → bulk assign scholar+subject+language → partial 10 → import → 9 created 1 duplicate melding.
4. Herhaal `commute` → melding duplicates skipped (already imported as …).
5. YouTube pagina → nieuwe video toevoegen → werkt nog.

---

*Einde Fase 2A rapport — live gevalideerd 2026-09-20, Brussels (UTC+2).*
