# Fase 2B — YouTube Import (op Archive.org architectuur)

**Datum:** 2026-09-21  
**Status:** Live — geen mocks, echte YouTube fetch zonder API-key, geïsoleerde provider-service

---

## 1. Doel & constraints

Echte YouTube-import bouwen **op** de Archive.org architectuur, zonder die te herschrijven:

- Archive functionaliteit niet wijzigen (routes, service, UI blijven)
- Neumorphic UI behouden
- Geen auth
- Geen nieuwe publieke UI — enkel admin
- Geen DB herstructurering (hergebruik generic `Content` + `ImportJob`, bestaande `@@unique([provider, externalIdentifier])`)
- Provider-service **volledig geïsoleerd** in `server/src/services/youtube.service.ts` (geen import van `archive.service.ts` behalve `parseDurationToMinutes`)

Ondersteund:
- **Single video**: `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `youtube.com/embed/`
- **Playlist**: `youtube.com/playlist?list=` of `youtube.com/watch?v=…&list=` als collection / ImportJob

---

## 2. Architectuur

```
Frontend                Backend
‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑    ‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑
YouTubeImportPage.tsx → POST /api/admin/imports/youtube/preview → youtube.service.ts → oEmbed + watch-page scrape
                     → ImportJob (provider=youtube, awaiting_review)
                     → POST /api/admin/imports/youtube/confirm → prisma Content.create (per item)
                                                        provider=youtube, externalIdentifier=videoId
                                                        collectionIdentifier=playlistId (bij playlist)
                                                        embedUrl=https://www.youtube.com/embed/<videoId>
ArchiveImportPage.tsx → POST /api/admin/imports/archive/preview → archive.service.ts (onveranderd)
```

**Isolatie:** `youtube.service.ts` importeert enkel `parseDurationToMinutes` uit `archive.service.ts` (pure functie) en verder geen archive-code. `import.ts` bevat twee aparte route-paren; `archive.service.ts` is ongewijzigd.

**DB:** `Content` blijft generic. Voor YouTube geldt:

- `provider = 'youtube'`
- `externalIdentifier = videoId` (11 chars)
- `sourceUrl = https://www.youtube.com/watch?v=<videoId>`
- `embedUrl = https://www.youtube.com/embed/<videoId>` (voor **alle** items, ook wanneer ze uit een playlist komen — playlist zelf als collectie embedt als `https://www.youtube.com/embed/videoseries?list=<playlistId>` maar individuele items behouden hun eigen video-embed)
- `collectionIdentifier = playlistId` (alleen bij playlist-import), `collectionTitle = playlist title`
- `durationMin` via zelfde betrouwbare parser als Archive (`parseDurationToMinutes`)
- `thumbnailUrl = https://i.ytimg.com/vi/<videoId>/hqdefault.jpg` (of maxres uit watch page)
- `metadata.youtube = { videoId, playlistId, title, channel, channelId, publishedAt, year, duration, thumbnail, youtubeUrl, importedFrom, importedAt, jobId }`

Geen stille fallback: als een echte YouTube URL niet ophaalbaar is, retourneert de API `502 { code: 'YOUTUBE_FETCH_FAILED', message }`.

---

## 3. Endpoints

### `POST /api/admin/imports/youtube/preview`
Request:
```json
{ "sourceUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }
```
Response (idem als Archive):
```json
{
  "jobId": "cm…",
  "sourceUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "identifier": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up…",
  "description": "The official video…",
  "totalItems": 1,
  "items": [{
    "identifier": "dQw4w9WgXcQ",
    "youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "embedUrl": "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up…",
    "kind": "video",
    "mediaTypes": ["YouTube Video"],
    "thumbnail": "https://i.ytimg.com/vi_webp/…/maxresdefault.webp",
    "creator": "Rick Astley",
    "channelId": "UCuAXFkgsw1L7xaCfnd5JJOw",
    "date": "2009-10-24T23:57:33-07:00",
    "year": 2009,
    "duration": "3:33"
  }],
  "fetchedAt": "21 Sept 2026",
  "isCollection": false,
  "isSingleItem": true,
  "provider": "youtube",
  "kindsSummary": { "video": 1 }
}
```
Voor playlist:
```json
{
  "identifier": "PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI",
  "title": "Popular Music Videos",
  "totalItems": 100,
  "isCollection": true,
  "items": [ /* max 100, deduped, elk met eigen identifier/videoId */ ]
}
```
Bij ongeldige URL: `400 { code: 'VALIDATION_ERROR' }` of `502 { code: 'YOUTUBE_FETCH_FAILED' }`.

### `POST /api/admin/imports/youtube/confirm`
Request:
```json
{
  "jobId": "cm…",
  "items": [
    {
      "identifier": "dQw4w9WgXcQ",
      "selected": true,
      "customTitle": "My Title",
      "customDescription": "…",
      "contentType": "video",
      "scholarIds": ["…"],
      "subjectIds": ["…"],
      "language": "English",
      "series": "Series name",
      "category": "Video",
      "status": "draft" // draft | published | skip
    }
  ]
}
```
Response:
```json
{
  "jobId": "cm…",
  "summary": { "totalFound": 100, "totalRequested": 2, "created": 2, "duplicates": 0, "errors": 0, "skipped": 1 },
  "results": [
    { "identifier": "fOT0BUpITw8", "status": "created", "contentId": "cm…", "slug": "…" },
    { "identifier": "NFvDHYMzj9U", "status": "duplicate", "message": "Already imported as \"…\"" }
  ]
}
```
Validatie: `published` vereist minstens één `scholarId` en één `subjectId`, anders `error: "Published requires…"`.

---

## 4. URL-detectie

`parseYouTubeUrl(url)` in `youtube.service.ts`:

| Voorbeeld | videoId | playlistId | isPlaylist | isVideo |
|-----------|----------|-------------|------------|---------|
| `https://www.youtube.com/watch?v=dQw4w9WgXcQ` | `dQw4w9WgXcQ` | null | false | true |
| `https://youtu.be/dQw4w9WgXcQ` | `dQw4w9WgXcQ` | null | false | true |
| `https://www.youtube.com/shorts/dQw4w9WgXcQ` | `dQw4w9WgXcQ` | null | false | true |
| `https://www.youtube.com/embed/dQw4w9WgXcQ` | `dQw4w9WgXcQ` | null | false | true |
| `https://www.youtube.com/playlist?list=PL…` | null | `PL…` | true | false |
| `https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL…` | `dQw4w9WgXcQ` | `PL…` | true | false |
| `https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s` | `dQw4w9WgXcQ` | null | false | true |

Logica: host check (`youtube.com`, `youtu.be`, `youtube-nocookie.com`), `list` param wint (playlist), anders `v`, `shorts/`, `embed/`, `v/`, `live/` segmenten. `videoId` wordt gestript van `?`/`&`/`/`, minimaal 5 chars, typisch 11 chars `[a-zA-Z0-9_-]{11}`.

404-afhandeling: `previewYouTube` gooit `YouTube video not found: <id>` of `YouTube playlist not found or unavailable`.

---

## 5. Metadata mapping

### Single video
- **oEmbed** (`https://www.youtube.com/oembed?url=…&format=json`) voor snelle `title`, `author_name`, `thumbnail_url`.
- **Watch pagina** (`/watch?v=`) HTML → `ytInitialPlayerResponse` via gebalanceerde-brace parser (`extractBalancedJson` met string/escape tracking). Daaruit:
  - `videoDetails.title`, `shortDescription`, `lengthSeconds` → `durationStr` via `formatDurationFromSeconds` ( `3600→1:00:00`, `213→3:33`),
  - `videoDetails.thumbnail.thumbnails[-1].url` of `hqdefault.jpg`,
  - `author` / `ownerChannelName` → `creator` / `publisher`,
  - `channelId`, `publishDate`/`uploadDate`.

Truncate: `title` 300, `description` 900, `creator` 200, `duration` 100.

### Playlist
- **Playlist pagina** (`/playlist?list=`) HTML → `playlistMetadataRenderer.title` & `description` (met `safeUnescapeJsonString` voor `\"`, `\n`, `\u0026` etc., fallback `<title>`), `ownerText.runs[0].text` → channel.
- **Video's** via `lockupViewModel` (nieuwe UI, 100+ per pagina, i.p.v. verouderde `playlistVideoListRenderer`):
  - per `lockupViewModel` blok (15k slice):
    - `videoId` via `"videoId":"([a-zA-Z0-9_-]{11})"`,
    - `title` via `"lockupMetadataViewModel":{"title":{"content":"…"}}`,
    - `duration` via `"thumbnailBadgeViewModel"[\s\S]*?"text":"(\d+:\d+(?::\d+)?)"`,
    - `creator` via `"metadataRows":[{"metadataParts":[{"text":{"content":"…"}}`,
    - `thumbnail` via `"url":"https://i.ytimg.com/vi/…"` (geünescaped `\u0026` → `&`), fallback `hqdefault.jpg`.
  - Dedup via `Set`, `slice(0,100)`. Fallback indien <3 video's: generieke `"videoId":"…"` regex.

Geen `ytInitialData` walking nodig; regex is deterministisch en snel (7s timeout, UA + `Accept-Language`).

---

## 6. Duplicate logic

DB heeft `@@unique([provider, externalIdentifier])` op `contents` (dé Fase 2A hardening). Voor YouTube:

- `provider = 'youtube'`, `externalIdentifier = videoId` (bijv. `dQw4w9WgXcQ`).
- Bij `confirm` doet de route eerst `prisma.content.findFirst({ where: { provider:'youtube', externalIdentifier:id }})`. Als al aanwezig → resultaat `duplicate`, geen nieuw record.
- Zelfde semantiek als Archive (daar `provider='archive'`). Cross-provider isolatie: `archive` met `externalIdentifier='dQw4w9WgXcQ'` en `youtube` met zelfde id zijn **verschillende** records (getest).

Fout bij race: `P2002` op `contents_provider_externalIdentifier_key` → wordt als `duplicate` gerekend.

---

## 7. Playlist handling

- Detectie: `isPlaylist` → `previewYouTube` roept `fetchPlaylistPage`.
- Preview: `totalItems = videos.length` (max 100), `isCollection:true`, `identifier=playlistId`, `items` elk eigen `identifier=videoId`, `youtubeUrl`, `embedUrl` (individueel), `duration`.
- Selectie: frontend toont checkbox per item, `selectAllFiltered`, `applyBulk`, zoek & paginatie (20/pagina).
- Confirm: elk **geselecteerd** (en niet `skip`) item → eigen `Content` record:
  ```ts
  provider: 'youtube',
  externalIdentifier: videoId,
  sourceUrl: youtubeVideoLink(videoId),
  embedUrl: youtubeEmbedLink(videoId), // individueel
  collectionIdentifier: playlistId,
  collectionTitle: playlistTitle,
  durationMin: parseDurationToMinutes(duration),
  ```
  Zelfde `collectionIdentifier`/`collectionTitle` voor alle items uit één playlist-import (getest).

Embed nuance: collectie zelf zou als `https://www.youtube.com/embed/videoseries?list=<playlistId>` kunnen embedden, maar voor playlist-import embedden we **individuele video's** (`/embed/<videoId>`) — conform requirement.

---

## 8. Beperkingen

- Geen officiële YouTube Data API — scraping van `ytInitialPlayerResponse` en `lockupViewModel`. Wijziging van YouTube HTML kan parsing breken (dan 502).
- Playlist pagination: enkel eerste pagina (≈100 video's). Playlists >100 worden afgekapt op 100 (expliciet in preview `slice(0,100)`).
- Private / lege / geo-blocked playlists → `YouTube playlist empty or unavailable` (502).
- `oEmbed` geeft geen `duration`/`description`; daarom is watch-page scrape nodig. Indien watch scrape faalt maar oEmbed slaagt, wordt alleen oEmbed title/thumb gebruikt.
- Geen transcriptie of chapters import.
- `language`/`subjectHint` uit YouTube enkel via heuristiek (creator-naam → scholar, subjectHint → subject id) — geen YouTube-categorie mapping.

---

## 9. Tests

### Automatisch — `server/test/audit.test.ts` (Fase 2A hardening, blijft groen)
- Duration parsing 16 cases, duplicate DB P2002, null externalIdentifier, geen kunstmatige pages/duration, ImportJob states, generic Content.

### Nieuw — `server/test/youtube.test.ts` (14+ cases, live YouTube)
| # | Case | Verwacht |
|---|------|----------|
| 1 | Single parse `watch` | `isVideo` true |
| 2 | `youtu.be/` | `isVideo` true |
| 3 | `shorts/` | `isVideo` true |
| 4 | `embed/` | `isVideo` true |
| 5 | `playlist?list=` | `isPlaylist` true, playlistId |
| 6 | `watch?v=&list=` | playlist |
| 7 | Single preview live `dQw4w9WgXcQ` | title/duration/thumbnail/embed correct, `parseDurationToMinutes("3:33")→4` |
| 8 | Playlist preview live `PLFgqu…` (Popular Music Videos) | 100 items, dedup, `thumbnailBadgeViewModel` duration `3:55` etc, `embed` individueel |
| 9 | `watch?v=&list=` preview | isCollection true |
|10 | Max 100 (PLMC playlist >100 → 100) | `totalItems==100` |
|11 | Invalid video `invalid12345` | `YouTube video not found` (502, geen fallback) |
|12 | Duplicate single (twee keer zelfde videoId) | tweede `P2002` / `duplicate` |
|13 | Duplicate playlist item (item uit playlist daarna opnieuw single) | `P2002` |
|14 | Partial selectie (2 van 3 uit playlist) | 2 records, `collectionIdentifier` gelijk |
|15 | Draft (zonder scholar/subject ok) | status draft |
|16 | Published met scholar/subject | status published, links aanwezig |
|17 | Published zonder scholar/subject | `error: Published requires…` |
|18 | Duration → `durationMin` | `3:33→4`, `10:50→11` |
|19 | Embed | single `https://www.youtube.com/embed/<id>`, playlist items individueel |
|20 | collectionIdentifier/Title | alle playlist-items delen `playlistId` & `Popular Music Videos` |
|21 | Invalid URL (non-youtube) | `Cannot parse YouTube identifier…` |
|22 | Provider-isolatie (zelfde externalIdentifier maar `archive` vs `youtube` mag) | beide kunnen |

Live checks na builds:
- `curl POST /api/admin/imports/youtube/preview {watch}` → 200 Rick Astley
- `curl POST /api/admin/imports/youtube/preview {playlist}` → 200 100 items
- `curl POST … {invalid}` → 502 `YOUTUBE_FETCH_FAILED`
- `curl POST /api/admin/imports/archive/preview {commute}` → nog steeds 200 (Archive onveranderd)
- `POST /confirm` draft → `created:1`; duplicate → `duplicates:1`; playlist partial → `created:2, skipped:1`; dubbele playlist item → duplicate; published validatie → error indien missing scholar/subject

Builds:
- `npx prisma validate` ✅ `The schema at prisma/schema.prisma is valid`
- `npx prisma migrate status` ✅ `Database schema is up to date!`
- `npm --prefix server run build` ✅ `tsc -p tsconfig.json` 0 errors
- `npx tsc --noEmit` frontend ✅
- `npm run build` (vite) ✅ `dist/index.html 595.08 kB` (voorheen 567 kB)

---

## 10. Gewijzigde bestanden

| Bestand | Wijziging |
|---------|-----------|
| `server/src/services/youtube.service.ts` | **Nieuw** — geïsoleerde provider-service (≈520 regels): `parseYouTubeUrl`, `previewYouTube`, `fetchVideoMetadata`, `fetchPlaylistPage` (lockupViewModel + thumbnailBadgeViewModel), `formatDurationFromSeconds`, `safeUnescapeJsonString`, `extractBalancedJson`, 7s timeout, UA, max 100 |
| `server/src/routes/import.ts` | Uitgebreid met `POST /api/admin/imports/youtube/preview` en `/youtube/confirm` (hergebruik `ImportJob` + generic `Content`, duplicate check provider+youtube, collectionIdentifier/Title, durationMin, per-item scholar/subject validatie). Archive-routes ongewijzigd. |
| `src/lib/api.ts` | Toegevoegd `YouTubePreviewResponse`, `previewYouTube()`, `confirmYouTube()` |
| `src/admin/data.ts` | Toegevoegd `YouTubeDetectedItem`, `YouTubeCollectionResult`, `YouTubeImportDraft`, `parseYouTubeIdentifier`, `getYouTubeEmbedUrl` + helpers; Archive-types ongewijzigd |
| `src/admin/YouTubeImportPage.tsx` | **Nieuw** — neumorphic admin pagina (≈600 regels) voor YouTube single/playlist: URL input (watch/youtu.be/shorts/embed/playlist), live detect, checkbox-select, bulk scholar/subject/lang, zoek + paginatie, per-item title/contentType/scholar/subject/language/status/description/category, embed preview, sticky import bar (`Import X as separate records`), `collectionIdentifier` hint |
| `src/admin/AdminLayout.tsx` | Nav uitgebreid met `YouTube Bulk`, bulk-badge check voor beide, sidebar knop `YouTube Bulk Import`, mobile menu tweede knop |
| `src/App.tsx` | Lazy route `youtube-import` toegevoegd naast `archive-import` |
| `server/test/youtube.test.ts` | **Nieuw** — 14+ cases audit (parse, live single/playlist, max 100, invalid, duplicate, partial, draft/published, scholar/subject, duration/embed, collection, provider-isolatie) |
| `docs/FASE2B_YOUTUBE.md` | Dit document |

Niet gewijzigd (bewust): `server/src/services/archive.service.ts`, publieke `src/pages/*`, `server/prisma/schema.prisma` (geen migratie nodig — generic `Content` reeds geschikt), neumorphic styling.

---

## 11. Voorbeeld flows

**Single:**
```
POST /youtube/preview { "sourceUrl": "https://youtu.be/dQw4w9WgXcQ" }
→ { identifier:"dQw4w9WgXcQ", isSingleItem:true, items:[{duration:"3:33", embedUrl:"…/embed/dQw4w9WgXcQ"}] }
POST /youtube/confirm { jobId, items:[{identifier:"dQw4w9WgXcQ", status:"draft"}] }
→ Content { provider:"youtube", externalIdentifier:"dQw4w9WgXcQ", embedUrl:"…/embed/dQw4w9WgXcQ", collectionIdentifier:null, durationMin:4 }
```

**Playlist (100 max):**
```
POST /youtube/preview { "sourceUrl": "https://www.youtube.com/playlist?list=PLFgqu…" }
→ { identifier:"PLFgqu…", isCollection:true, totalItems:100, items:[{identifier:"fOT0BUpITw8", duration:"3:55", embedUrl:"…/embed/fOT0BUpITw8", collection:"PLFgqu…"}, …] }
POST /youtube/confirm { jobId, items:[{identifier:"fOT0BUpITw8", status:"published", scholarIds:[…], subjectIds:[…]}, {identifier:"NFvDHYMzj9U", status:"draft"}, {identifier:"8c7K…", selected:false}] }
→ 2 Contents, beide collectionIdentifier="PLFgqu…", collectionTitle="Popular Music Videos", embeds individueel
```

Duplicate:
```
POST /youtube/preview { "sourceUrl": "https://www.youtube.com/watch?v=fOT0BUpITw8" }
POST /youtube/confirm { jobId, items:[{identifier:"fOT0BUpITw8"}] } → { status:"duplicate" }
```

---

## 12. Verwijdering / rollback

Alleen `youtube.service.ts`, `YouTubeImportPage.tsx`, `test/youtube.test.ts` en de twee routes in `import.ts` verwijderen; `api.ts`/`data.ts`/`AdminLayout.tsx`/`App.tsx` terugzetten. Archive blijft onaangeroerd.
