# Fase 3.5 — LIBRARY UX + CONTENT STRUCTURE

**Datum:** 2026-09-23  
**Status:** Live — series/playlists als één collectie, thumbnails gefixt, eigen audio player, downloads via echte file URL, geen nieuwe DB-architectuur.

---

## 1. Wat gewijzigd is

| Domein | Bestand | Wijziging |
|---|---|---|
| **Series / grouping** | `src/lib/series.ts` (nieuw) | `groupByCollection(contents)` — groepeert op `collectionIdentifier`. `≥2` items met zelfde id → `SeriesGroup` (id, title, provider, count, items, thumbnail, subjects/scholars). `getDownloadUrl()` + `getAudioStreamUrl()` — echte directe file URL alleen voor Archive file-level (`parent--Base` → `https://archive.org/download/<parent>/<Base>.mp3/.pdf`), PDF direct, geen fake URL voor YouTube/Google Books. |
| **Audio player** | `src/components/AudioPlayer.tsx` (nieuw) | Eigen ilmNet player — play/pause, progress slider, current/duration, waveform (24 bars, rose/olive neumorphic), `audio` element met `preload=metadata`, fallback naar `iframe` als directe stream niet beschikbaar. Stijl identiek aan homepage `LectureSurface` (cream/sand, neu-raised/inset). |
| **Lectures** | `src/pages/Lectures.tsx` | Voorheen vlakke lijst. Nu `groupByCollection` na fetch — toont **Series & Playlists** eerst (SeriesCard: aspect-[16/10], collection badge, count, provider) en daarna **Single lectures**. Thumbnail `aspect-[16/10]` + `object-cover` (vast, geen stretch). Stat toont `Items / Series`. |
| **Books** | `src/pages/Books.tsx` | Analoog: **Collections** (aspect-[3/4] voor boeken, vaste ratio) + **Single books**. CollectionCard met Archive badge, count. Cover `object-cover` binnen `aspect-[3/4]`. |
| **Series detail** | `src/pages/SeriesDetail.tsx` (nieuw) | Route `/series/:id` — laadt alle `published` en filtert op `collectionIdentifier`, sorteert op titel, toont `EpisodeRow` (thumb `aspect-[16/10]` w-32/40, nummer, type). Header met collectionTitle/provider, link terug. |
| **Subject detail** | `src/pages/SubjectDetail.tsx` (nieuw) | Route `/subjects/:id` — toont subject info + **Series — Subject** eerst (bv. Aqeedah → Tahawiyyah serie), daarna **Collections**, daarna **Single lectures/books**. Gebruikt zelfde `groupByCollection` per subject. Voorbeeldstructuur `Aqeedah → Tahawiyyah → Lezing 1-4` werkt wanneer meerdere items met zelfde `collectionIdentifier` en subject `aqeedah` bestaan. |
| **Subjects lijst** | `src/pages/Subjects.tsx` | Tile link `Explore` nu naar `/subjects/${slug}` (was `/lectures` generiek) — bezoeker ziet eerst series per subject. |
| **Content detail** | `src/pages/ContentDetail.tsx` | Compleet herschreven: `Embed` gebruikt `AudioPlayer` voor `type audio` (direct stream via `getAudioStreamUrl`, anders embed fallback + nette melding), PDF/Book via `iframe` + download knop, Archive book `aspect-[3/4]` → `aspect-[16/10]` responsive, download via `getDownloadUrl` (echte URL) of fallback `Open on Archive.org`. `SeriesNav` onder detail toont max 6 siblings uit zelfde collectie (filter op `collectionIdentifier`). Collection link naar `/series/:id`. Download sectie: `Download` alleen als echte URL beschikbaar, anders verbergen. Cover sectie met `object-contain` binnen `neu-inset`. |
| **Routing** | `src/App.tsx` | Nieuwe routes `/series/:id` en `/subjects/:id` binnen `Layout`. |
| **Thumbnails** | Alle cards | Vaste `aspect-[16/10]` (lectures/audio/video) of `aspect-[3/4]` (books), `absolute inset-0 h-full w-full object-cover`, `overflow-hidden rounded-[22px]`, `loading=lazy`, `onError` hide. Geen uitgerekte layout, werkt op mobiel/desktop. |

Geen nieuwe DB-tabellen, geen nieuwe `Lecture/Playlist/Book` modellen — alleen bestaande `Content` velden `collectionIdentifier/collectionTitle/provider/type/thumbnailUrl/coverUrl` hergebruikt.

---

## 2. Hoe series/playlists nu werken

- **YouTube playlist** `PLB1_h06YGESJOklRpiVLn6S4qsk4azOrZ` (7 videos): voorheen 7 losse kaarten tussen lectures. Nu 1 **SeriesCard** `Islamic Lectures — Playlist · 3` (3 gepublished, 2 drafts → totaal 3 in test, na publish 3). Klik → `/series/PLB1_h06YGESJOklRpiVLn6S4qsk4azOrZ` → 3 EpisodeRows met thumb, nummer, duration.

- **Archive books** `CollectionOfIslamicBooks` (8 boeken): voorheen 8 losse boeken. Nu 1 **CollectionCard** `Collection Of Islamic Books — Collection · 5` (5 gepublished) in `/books`, klik → serie-detail met 5 boeken.

- **Archive audio** `RenewingOurIntentions` (100 audios, capped): 1 **SeriesCard** `Islamic Lectures: By Bilal Philips — Collection · 3` (3 gepublished) in `/lectures`, episodes als audio.

- **Logica:** `collectionIdentifier` is sleutel. Items met zelfde id en `≥2` published worden serie; singles blijven los. Sortering: series alfabetisch op titel, singles op `updatedAt` desc. Binnen serie episodes alfabetisch. Werkt voor YouTube én Archive.

- **Subject-voorbeeld Aqeedah:** als meerdere items met `collectionIdentifier = tahawiyyah` en `subject = aqidah` bestaan, toont `/subjects/aqidah` eerst `Series — Aqeedah` met daarin `Lezing 1-4`, daarna singles. Getest met `Family & Society` (PLB1 + Renewing) — beide series verschijnen boven singles.

- **Detailpagina:** elk item met `collectionIdentifier` toont link `View series` + `SeriesNav` met siblings (max 6).

---

## 3. Audio player

- **Niet** de standaard Archive.org pagina/player.
- **Eigen ilmNet player** `AudioPlayer` — `play/pause` (rose `neu-raised-sm` knop), `progress` slider (`accent-rose`, `neu-inset-sm`), `duration` links/rechts (`0:00` format), **waveform** 24 bars (`bg-rose/85` actief, `bg-olive/30` inactief, hoogte 14–52px), huidige positie via `currentTime/duration *100`, responsive `p-6 sm:p-8`, `rounded-[28px]` `neu-raised`, provider badge.
- **Stream:** directe MP3 via `getAudioStreamUrl` → `https://archive.org/download/<parent>/<Base>.mp3` (302 naar CDN, getest 200). Voor YouTube of zonder directe URL → fallback naar `iframe` embed (`Archive.org audio — embed fallback` melding).
- **Voorbeeld:** `/lectures/23September2011BenefitOfAdheringToTheQuranAndTheSunnah` speelt direct MP3.

---

## 4. Downloads

- **Onderzoek per provider:**
  - **Archive audio** → `https://archive.org/download/<parent>/<Base>.mp3` (echt, 302 getest)
  - **Archive book/PDF** → `https://archive.org/download/<parent>/<Base>.pdf` (echt, 302 getest)
  - **PDF provider** → `sourceUrl` als `.pdf`
  - **External** → alleen als `sourceUrl` eindigt op `.pdf/.mp3/.mp4/.m4a/.ogg/.epub`
  - **YouTube / Google Books** → geen directe download (juridisch) → knop verborgen
- **UI:** `Download` knop (`bg-cream neu-raised-sm` of `bg-olive text-white`) alleen als `getDownloadUrl` non-null, anders `Open on Archive.org` fallback. Nooit fake.
- **Getest:** Atlas Of The Quran PDF en 23September… MP3 downloaden via directe URL.

---

## 5. Thumbnail fix

- **Probleem:** voorheen `h-40` / `h-48` zonder vaste ratio, verschillende formaten werden uitgerekt.
- **Fix:** alle cards nu `aspect-[16/10]` (lectures/audio/video, series) of `aspect-[3/4]` (books/collections), `relative overflow-hidden`, `img` met `absolute inset-0 h-full w-full object-cover`, `rounded-[22px]`, `loading=lazy`, `onError` hide. Fallback gradient `from-olive/10 to-rose/10` als geen thumb. Responsive: `w-32 sm:w-40` in EpisodeRow, grids `sm:grid-cols-2 lg:grid-cols-3`. Getest op mobiel/desktop, geen stretch.

---

## 6. Books ervaring

- **Cover:** `aspect-[3/4]` `object-cover` of fallback boek-illustratie (gradient + titel). Detailpagina: `bg-sand neu-inset` met `object-contain` `max-h-[420px]`.
- **Card/frame:** `rounded-[30px] p-6` `neu-raised`, consistente spacing.
- **Detailpagina:** zelfde als lectures maar met book-specifieke embed (`aspect-[3/4]` → `aspect-[16/10]` op desktop), `Download PDF` knop.
- **Reader/embed:** `iframe` naar `embedUrl` (`.../embed/CollectionOfIslamicBooks?subPrefix=Atlas…` of Google Books), fallback `Open on Archive.org`.
- **Metadata:** scholar/subject/language/year/pages/duration/collection allemaal getoond.
- **Collection/series:** boeken met zelfde `CollectionOfIslamicBooks` → 1 CollectionCard, detail via series page.

---

## 7. Design

Behouden: `cream #fdf8f0`, `sand`, `olive`, `rose`, `ink`, `neu-raised/inset/float` shadows, `rounded-[30px]`, `font-display Plus Jakarta Sans`, `Aurora` op hero, responsive `px-5 sm:px-6 lg:pb-32`, premium rustig, geen religieuze symbolen.

---

## 8. Backend

Geen nieuwe architectuur. Alleen `collectionIdentifier/collectionTitle` reeds in `prisma/schema.prisma` gebruikt. Geen migratie nodig. Indien nodig zou directe file URL in `metadata` kunnen worden opgeslagen, maar nu derivation volstaat.

---

## 9. Tests — echt content

Getest 2026-09-23 10:55 UTC (live HTTP, geen mocks):

- **YouTube single** `https://youtu.be/T-4XGWUV8hI?si=CYI_nUlBmI5qgASh` → 1 video, titel Arabisch correct, `isSingleItem true`
- **YouTube playlist** `https://youtube.com/playlist?list=PLB1_h06YGESJOklRpiVLn6S4qsk4azOrZ&si=TdkXIoiORTzfsmoV` → 7 items, nu als **één serie** `Islamic Lectures` (3 gepublished) in `/lectures` + `/series/PLB1…` met 3 episodes
- **Archive books** `https://archive.org/details/CollectionOfIslamicBooks/Atlas%20Of%20The%20Quran/` → 8 boeken, nu **één collectie** (5 gepublished) in `/books` + `/series/CollectionOfIslamicBooks`
- **Archive audio** `https://archive.org/details/RenewingOurIntentions` → 100 audios, 3 gepublished als **één serie** met eigen player (direct MP3 stream getest)

**Handmatig gecontroleerd:**

- `/lectures` → Series & Playlists boven Singles ✓
- `/books` → Collections boven Singles ✓
- `/subjects` → Explore naar `/subjects/:slug` ✓
- `/subjects/family-and-society` → toont 2 series (PLB1 + Renewing) + singles ✓
- `/series/PLB1_h06YGESJOklRpiVLn6S4qsk4azOrZ` → 3 episodes ✓
- `/series/CollectionOfIslamicBooks` → 5 books ✓
- Audio detail → eigen player met play/progress/waveform ✓, download MP3 ✓
- Book detail → cover, reader, download PDF ✓
- Thumbnails → vaste ratio, object-cover, mobiel/desktop correct ✓
- Downloads → echte URLs, geen fake, YouTube verborgen ✓

---

## 10. Regressietests

```
prisma validate         → valid 🚀
prisma migrate status   → up to date (2 migrations)
backend tsc --noEmit    → ok
frontend tsc --noEmit   → ok (146 modules)
vite build              → 624.51 kB gzip 157.16 kB (was 592.66 kB)
audit.test.ts           → All audit tests passed
youtube.test.ts         → All YouTube audit tests passed (14+ cases, live)
archive preview (4 URLs)→ all isCollection/isSingleItem correct
HTTP /api/contents      → published grouping correct (3+3+5 series)
```

Handmatig `/lectures`, `/books`, `/subjects`, subject-playlist, playlist/series detail, audio/book detail, mobiel/desktop — allemaal ok.

---

## 11. Beperkingen

- Directe download voor **single Archive items** (niet file-level) niet geconstrueerd — geen betrouwbare filename zonder metadata, dus fallback naar `Open on Archive.org` i.p.v. fake.
- YouTube directe audio/PDF download nooit beschikbaar — correct verborgen.
- Thumbnails voor Archive file-level delen parent thumb (`/services/img/<parent>`) — geen per-file thumb beschikbaar.
- Series sortering alfabetisch op titel, niet op originele volgorde (YouTube playlist volgorde is nu op titel, niet playlist order — zou via `position` kunnen maar niet in DB).
- Subject-detail gebruikt `q` filter als fallback — bij zeer grote DB zou dedicated `where.collectionIdentifier` endpoint efficiënter zijn, maar voor 100 items prima.

Geen mocks, geen fake URLs, bestaande import niet gebroken.
