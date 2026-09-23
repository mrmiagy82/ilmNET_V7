# Fase 3.6 — AUDIO + THUMBNAILS

**Datum:** 2026-09-23
**Scope:** drie punten — realtime waveform, default audio-thumbnail, admin thumbnail/cover upload.
Bestaande series/collections, player, downloads en Archive/YouTube-import blijven ongewijzigd werken.

---

## 1. Realtime waveform (Web Audio API)

**Bestand:** `src/components/AudioPlayer.tsx`

- `AudioContext` → `createMediaElementSource(audio)` → `AnalyserNode` (`fftSize 64` = 32 bins, `smoothingTimeConstant 0.78`, `minDecibels -85`) → `destination`.
- De audio- en analyser-graaf wordt **exact één keer** per `<audio>`-element opgebouwd (een `MediaElementSourceNode` mag maar één keer per element bestaan), lazy bij de eerste user-gesture (play) — daarna blijft hij geldig bij elke `src`-wissel.
- Tijdens playback draait een `requestAnimationFrame`-loop die `getByteFrequencyData` uitleest, de 32 bins middelt naar **24 bars** en de hoogte zet op `10 + (avg/255) * 46` px (10–56 px). Styling blijft identiek: `rounded-full`, actief `bg-rose/85`, inactief `bg-olive/30`, `h-16` waveform, neumorphic controls.
- Pauzeren → loop stopt en de bars vallen terug op het vaste rustpatroon; de voortgangskleur blijft aan de seek-positie gekoppeld.
- Nieuw statusbadge `data-testid="waveform-status"`: **“Live waveform”** (met pulserende stip) zodra er écht signaal binnenkomt (`peak > 4`), anders “Waveform”. Transparant, geen nep-animatie.
- `<audio>` krijgt `crossOrigin="anonymous"`; Archive.org stuurt `access-control-allow-origin: *` (ook op de CDN-redirect), dus de analyser leest het echte signaal. Mislukt Web Audio (geen CORS / geen ondersteuning), dan blijft de waveform statisch en blijft de player werken.
- Seek, play/pause, duration en de embed-fallback zijn ongewijzigd; ook ná het koppelen van de Web Audio-graaf blijft seeken werken (getest).

## 2. Default audio thumbnail (geen zwarte Archive-afbeelding)

**Bestanden:** `src/lib/thumbnail.ts` (nieuw), `src/components/AudioPlaceholder.tsx` (nieuw)

Prioriteit bij het renderen:

1. **custom upload** uit de Admin CMS (`/uploads/<file>` of `data:image/…`) → altijd voorrang
2. **provider thumbnail** (YouTube `i.ytimg.com`, Archive cover/thumb, Google Books) — behalve `archive.org/services/img` bij `type = audio` (dat is de zwarte/generieke placeholder)
3. **ilmNet placeholder** — voor audio de nieuwe `AudioPlaceholder` (sand/cream `neu-inset` vlak met een `neu-raised-sm` icoon-tegel en een neutrale audio-glyph: noten + speaker, géén religieuze symbolen); voor boeken blijft de bestaande gegenereerde rug.

`resolveThumbnail()` / `resolveCover()` / `resolveCardMedia()` leveren `{ src, kind, source }` zodat elke kaart weet of er een echte afbeelding is (`source: 'custom' | 'provider' | 'none'`). Toegepast op: `/lectures` (cards + series), `/books` (covers + collections), `/series/:id`, `/subjects/:id`, detailpagina (SeriesNav-thumbs, Artwork-sectie, cover), plus admin-lijsten.

## 3. Admin CMS: eigen thumbnail/cover uploaden

**Backend**
- `src/routes/uploads.ts` (nieuw): `POST /api/admin/uploads` (multipart, veld `file`, alleen `image/jpeg|png|webp|gif|avif`, max 5 MB) → schrijft naar `server/uploads/<naam>-<stamp>.png`, antwoordt `{ data: { url: "/uploads/<file>", filename, bytes, mime } }`. `GET /api/admin/uploads` (alleen afbeeldingen), `DELETE /api/admin/uploads/:filename`.
- `src/server.ts`: `@fastify/multipart` + `@fastify/static` op prefix `/uploads/`; de bestaande admin-token-hook beschermt de schrijf-endpoints.
- `src/lib/validation.ts`: `thumbnailUrl`/`coverUrl` accepteren nu ook `/uploads/…` en `data:image/…` naast absolute http(s)-URL's; rommel zoals `javascript:` wordt geweigerd (400).
- `src/routes/content.ts`: lege string bij PATCH betekent “veld leegmaken” → `NULL` in de database (geen `''`).

**Frontend**
- `src/admin/MediaField.tsx` (nieuw): uploadveld met preview, drag & drop, `Upload image` / `Replace image` / `Remove custom` / `Use provider thumbnail`, inline URL-invoer en statusregel die precies laat zien wat er in de database staat (`Saved value: /uploads/…` + badge **Custom · priority**). Client-side validatie op type en 5 MB.
- Ingebouwd in `LectureForm` (thumbnail), `BookForm` (cover) en `ContentWizard` (thumbnail- en coverstap + quick-fields): de keuze wordt via `api.uploadImage()` → `thumbnailUrl` / `coverUrl` opgeslagen in de database.
- Uploads staan in `server/uploads/` (runtime, gitignored, map blijft in de repo via `.gitkeep`); de database bewaart het pad `/uploads/<file>`.
- Vite proxyt `/uploads` naar de backend zodat previews en de publieke site de afbeeldingen direct tonen.

**Prioriteit:** een custom upload wint altijd van de provider thumbnail. Omdat imports alleen `create` doen (duplicaten worden overgeslagen), kan een her-import een gekozen afbeelding ook niet overschrijven.

---

## 4. Tests (allemaal tegen de echte database/site, geen mocks)

### `server/test/uploads.test.ts` — 25 checks, `npm run test:uploads`
1. Echte PNG uploaden → 201, `/uploads/…`, mime + bytes, bestand byte-identiek op schijf
2. Statisch serveren → 200, `image/png`, bytes identiek
3. `text/plain` → 415; >5 MB → 413 (en geen half bestand achtergelaten)
4. Content aanmaken met custom thumbnail → `thumbnailUrl` in de DB, herlezen uit de database
5. Publieke API (`GET /api/contents/:id`) geeft de custom thumbnail terug
6. PATCH → provider-URL; PATCH `""` → `NULL` (fallback naar provider/placeholder)
7. `javascript:` geweigerd (400), `/uploads/…` opnieuw geaccepteerd (200)
8. Listing bevat alleen afbeeldingen; DELETE haalt het bestand van schijf

### `tests/e2e/media.spec.mjs` — 27 checks, `npm run test:e2e` (Playwright + Chromium)
1. **Realtime waveform** op een échte Archive-opname: 24 bars, audio speelt (`currentTime` loopt door), 18 frames uit 18 samples verschillend, hoogtes 10 → ~50 px, 14/24 bars bewegen onafhankelijk (spraakspectrum), badge “Live waveform”, pauze stopt beweging, seek naar 50% werkt mét analyser (1393 s), 24 bars op mobiel viewport
2. **Fallback**: detailpagina, seriepagina (`/series/RenewingOurIntentions`) en lectures-lijst tonen de placeholder en **nul** `archive.org/services/img` afbeeldingen; placeholder heeft de neumorphic opbouw + audio-glyph
3. **Custom thumbnail**: detailpagina toont `/uploads/…` (en server 200 + `image/*`), badge “Custom upload”, kaart in de lijst gebruikt dezelfde upload
4. **Admin CMS end-to-end**: uploaden via het echte formulier → veld toont `/uploads/…` + “Custom · priority” → “Publish to library” → record staat met `status published` en de custom thumbnail in de database → publieke detailpagina toont de geüploade afbeelding

### Regressie
```
prisma validate        → valid 🚀
prisma migrate status  → up to date (2 migrations)
backend tsc --noEmit   → ok
frontend tsc --noEmit  → ok
vite build             → 635.00 kB gzip 160.56 kB
audit.test.ts          → All audit tests passed
uploads.test.ts        → 25/25 passed
youtube.test.ts        → All YouTube audit tests passed (14+ cases, live)
media e2e              → 27/27 passed
import previews        → YT single 1 item · YT playlist 7 (isCollection) · Archive books 8 · Archive audio 100
published grouping     → 21 items · PLB1 3 · CollectionOfIslamicBooks 5 · RenewingOurIntentions 3 + singles
```

---

## 5. Beperkingen

- Geüploade bestanden staan op de server (`server/uploads/`, gitignored) — bij een deployment moeten die meegaan of opnieuw geüpload worden; de database bewaart alleen het pad.
- Web Audio werkt alleen met CORS-toegestane bronnen; Archive.org staat `*` toe, dus daar werkt het. Bij een bron zonder CORS-koppen blijft de waveform statisch (met de melding in de UI) in plaats van nep te bewegen.
- De analyser toont het spectrum per frequentieband (geen vooraf berekende golfvorm per tijdvak); bij spraak bewegen vooral de lage banden — dat is zichtbaar in de test (14/24 bars).
- Voor niet-audio content zonder enige afbeelding blijft de bestaande gradient/boekrug-fallback staan.

Geen mocks, geen fake media-URL's, bestaande imports en series/collections ongewijzigd.
