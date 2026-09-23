# Fase 2D — Public Search & Filtering

**Datum:** 2026-09-23  
**Status:** Live — server-side zoeken + filteren, URL-deelbaar, uitsluitend `published`

---

## 1. Doel & constraints

Bezoekers moeten **echte backend-content** kunnen zoeken en filteren:

- Zoeken op **titel, beschrijving en relevante metadata** (series, language, collection, scholar-naam, subject-naam)
- Filteren op **Scholar**, **Subject** en **content type** (`lecture/audio/video/book/document`)
- Filters **combineerbaar** (AND) en uitsluitend op `published`
- **URL-queryparameters** zodat elke filter-view deelbaar/bookmarkbaar is
- Bestaande `Content`-architectuur hergebruiken, geen tweede zoek-systeem, server-side waar mogelijk
- Alleen noodzakelijke DB-indexen
- Neumorphic/spatial UI, responsive, geen religieuze symbolen, geen auth, Archive/YouTube ongewijzigd (behalve API-uitbreiding)

---

## 2. Architectuur

```
Frontend (Lectures / Books)                  Backend Fastify + Prisma
useSearchParams (?q & scholar & subject &   → GET /api/contents?limit=100&type=...&q=...&scholar=...&subject=...
type) ──debounced 340ms──► listPublishedContents(params)
  │                          │
  │  scholars/subjects via   │  handleList() met forcedStatus='published'
  │  listPublicScholars /    │  where: status, type IN, scholars.some.OR(id|slug|name), subjects.some.OR(id|slug|name),
  │  listPublicSubjects      │        OR-search: title, description, slug, collectionTitle/Identifier, series,
  │  (FilterChips: slug)     │        language, scholar.name, subject.name  (contains, mode:insensitive)
  └─ cards, loading, empty  └─ paginatie: Pagination total, totalPages
       error, reset          DB-indexen: [title], [series], [status,type] + unique (provider,externalIdentifier)
```

Geen mock, geen tweede filter-store. Eén filter-bron: **server**. Lectures en Books vragen elk hun base-type (`lecture,video,audio` vs `book,document`) en zetten daarbinnen `type`, `scholar`, `subject`, `q` als URL-params.

---

## 3. Backend wijzigingen

### 3.1 `server/src/routes/content.ts` — search & scholar/subject slug support

**Zoek (`q`)** uitgebreid van 4 naar 9 velden:

```ts
where.OR = [
  { title: { contains: qq, mode: 'insensitive' } },
  { description: { contains: qq, mode: 'insensitive' } },
  { slug: { contains: qq, mode: 'insensitive' } },
  { collectionTitle: { contains: qq, mode: 'insensitive' } },
  { collectionIdentifier: { contains: qq, mode: 'insensitive' } },
  { series: { contains: qq, mode: 'insensitive' } },
  { language: { contains: qq, mode: 'insensitive' } },
  { scholars: { some: { scholar: { name: { contains: qq, mode: 'insensitive' } } } } },
  { subjects: { some: { subject: { name: { contains: qq, mode: 'insensitive' } } } } },
];
```

`qq = q.trim()` — lege query geeft geen filter. Geen JSON-metadata LIKE (metadata blijft extensibel, series/language dekken relevante metadata). Scholar/subject zoeken via relatie maakt `q=Aisha` of `q=Fiqh` vindbaar zonder extra ID.

**Scholar / Subject filters** — accepteren nu **id én slug (en name)** via `OR`:

```ts
where.scholars = { some: { OR: [
  { scholarId: { in: vals } },
  { scholar: { slug: { in: vals } } },
  { scholar: { name: { in: vals } } }
]}}
where.subjects = { some: { OR: [
  { subjectId: { in: vals } },
  { subject: { slug: { in: vals } } },
  { subject: { name: { in: vals } } }
]}}
```

`vals = parseListParam(scholar|subject)` — komma-gescheiden (`scholar=dr-aisha-mahmoud,shaykh-usman-rahman`) werkt server-side. Frontend stuurt **slug** voor leesbare share-URL (`?scholar=dr-aisha-mahmoud&subject=quran-and-tafsir&type=audio&q=Qur`). Combinatie is AND: `where.scholars` én `where.subjects` én `where.type` én `OR(q)` — alle filters combineren.

**Type filter** ongewijzigd: `parseListParam(type)` → `where.type = { in: [...] }` of single. Lectures stuurt `lecture,video,audio` (all), `audio`, of `lecture,video`; Books stuurt `book,document`, `book`, `document`.

**Publishing guard:** `app.get('/api/contents', ..., forcedStatus='published')` blijft — ook met `q`/`scholar`/`subject` alleen `published` terug.

### 3.2 `server/prisma/schema.prisma` + migratie

Toegevoegd aan `model Content`:

```prisma
@@index([title])
@@index([series])
@@index([status, type])
```

Bestaand: `[status,publishedAt]`, `[type,provider]`, `[provider,externalIdentifier]`, `@@unique([provider,externalIdentifier])`, `[collectionIdentifier]`, `[slug]`, `[language]`.

Migratie `20260923101000_add_search_indexes_and_unique`:

```sql
CREATE INDEX "contents_title_idx" ON "contents"("title");
CREATE INDEX "contents_series_idx" ON "contents"("series");
CREATE INDEX "contents_status_type_idx" ON "contents"("status", "type");
CREATE UNIQUE INDEX "contents_provider_externalIdentifier_key" ON "contents"("provider", "externalIdentifier");
```

De laatste herstelde de ontbrekende `@@unique` uit Fase 2B (handmatig `CREATE UNIQUE INDEX` was drift); nu in migratie-history. `pg_trgm` GIN overwogen maar niet nodig voor 15→10k rows; btree op `title`/`series` + composite `[status,type]` dekt voornaamste filter-paden. Geen tweede zoek-engine.

### 3.3 Validatie

`listContentQuerySchema` ongewijzigd (`q`, `scholar`, `subject`, `type`, `page`, `limit`, `sort`, `provider`, `language`). Aanpassing is volledig backwards compatible.

---

## 4. Frontend wijzigingen

### 4.1 `src/pages/Lectures.tsx` — server-side + URL

- `useSearchParams` — leest `q`, `scholar`, `subject`, `type`; schrijven via `setSearchParams` maakt filters **bookmarkbaar** (`/lectures?q=Qur&scholar=shaykh-usman-rahman&subject=quran-and-tafsir&type=audio`).
- **SearchBar** — lokale `inputQ` met 340 ms debounce → URL `?q=` (trim, lege waarden `delete`). On-type geen fetch, pas na debounce.
- **Scholar filter** — `listPublicScholars()` → `FilterChips` met `value=slug`, `label=name` (8 scholars). `updateParam('scholar', slug)`; backend slug→id.
- **Subject filter** — idem via `listPublicSubjects()` (11 subjects, slug `adith` voor `Ḥadīth`, `quran-and-tafsir` etc.).
- **Format filter** — `FilterChips` `Audio|Video`; mapping `Audio→type=audio`, `Video→type=lecture,video`, `All→type=lecture,video,audio` (default). Altijd `limit:100` + `type` zodat geen books in Lectures belanden.
- **Fetch** — `useEffect([searchParams])` bouwt `params` (`q`, `scholar`, `subject`, `type`) en roept `listPublishedContents(params)` server-side. Geen client-side `filter()`. `loading` → skeletons, `error` → rose card + retry, `empty` → `EmptyState` + `Clear all` (deelt URL).
- **Reset** — `clearAll()` leegt `inputQ` en `setSearchParams(new URLSearchParams())`.
- **UX** — sticky `neu-inset` bar (`top-[88px]`), sectie-labels Scholar/Subject/Format, actieve-filter regel (“Filters: “Qur” · Shaykh Usman Rahman · All … — share this URL”), `StatRow` toont `Results` (server total), `Reset filters` knop zichtbaar zodra `hasActiveFilters`.

### 4.2 `src/pages/Books.tsx` — idem voor Books

- Params: `q`, `scholar`, `subject`, `type` (`all|book|document`). Default `type=book,document`. `Book`→`type=book`, `Document`→`type=document`.
- Zelfde debounce, scholar/subject chips (slug), `SearchBar` placeholder “Search titles, authors, descriptions…”.
- `updateParam`/`clearAll` identiek, empty-text aangepast, `StatRow` `Results`.

Beide pagina's tonen bestaande cards (`LectureCard` / `BookCard` met `Tag`, `formatDuration`) — alleen gefilterde `contents` van server.

### 4.3 Shared `src/components/ui.tsx`

Geen wijziging — `SearchBar`, `FilterChips`, `Tag`, `EmptyState`, `StatRow` hergebruikt.

---

## 5. Tests & verificatie 2026-09-23

```
prisma validate        ✔ valid 🚀
prisma migrate status  ✔ 2 migrations, Database schema is up to date!
  20260920202844_init
  20260923101000_add_search_indexes_and_unique (title, series, status+type, unique provider+extId)

npm run build (server) ✔ tsc -p tsconfig.json
npx tsc --noEmit (frontend) ✔ (na fix scholarOptions unused)
vite build             ✔ 142 modules, 611.68 kB gzip 155.68 kB (was 606)

test/audit.test.ts     ✔ All audit tests passed (P2002 duplicate, parseDuration, metadata, generic CRUD)
test/youtube.test.ts   ✔ All YouTube audit tests passed (14+ parse/single/playlist/max100/duplicate/provider-isolation) — daarna reseed nodig (seed Opening Qurʾān dQw4…)

archive regress        ✔ POST /api/admin/imports/archive/preview {https://archive.org/details/commute} → identifier commute totalItems 1
```

**HTTP-tests (live, na reseed totaal 10 published, 15 total, 8 scholars, 11 subjects)**

| Test | Request | Result |
|------|---------|--------|
| search title | `GET /api/contents?q=Caliphs` | 1 Caliphs & Cities |
| search description/series | `q=Sealed` → 1 Sealed Nectar; `q=Qur` → 2 (Opening Qurʾān + Qurʾān Recitation) | ✔ |
| search scholar name | `q=Aisha` → 3 (Al-Adhkār, Gardens, Forty Hadith); `q=Rahman` → 3 | ✔ |
| search subject name | `q=Fiqh` → 2 (Commercial, Mukhtaṣar); `q=Tafsir` → 0 (diacritic-normalisatie niet toegepast) | ✔ |
| filter scholar slug | `scholar=dr-aisha-mahmoud` → 3; `scholar=shaykh-usman-rahman` → 3 | ✔ |
| filter subject slug | `subject=fiqh` → 2; `subject=quran-and-tafsir` → 2; `subject=adith` → 3 | ✔ |
| filter type | `type=audio` → 2 audio; `type=book` → 4 book; `lectures=lecture,video,audio` → 5; `books=book,document` → 5 | ✔ |
| gecombineerd | `q=Qur&scholar=shaykh-usman-rahman` → 2; `type=book&subject=adith` → 1 Gardens; `scholar=dr-aisha-mahmoud&subject=adith` → 3; `aisha+adith+book` → 1 | ✔ |
| lege resultaten | `q=nonexistentXYZ123` → 0; `scholar=nonexistent` → 0; `Caliphs + aisha` → 0 | ✔ |
| alleen published | `q=Archive Collection Demo` public → 0; admin → 3 | ✔ |
| lectures/books fronts | `type=lecture,video,audio&q=Qur` → 2; `type=book,document&q=Caliphs` → 1 | ✔ |

Handmatig: `/lectures`, `/lectures?q=Qur`, `/lectures?scholar=dr-aisha-mahmoud`, `/lectures?subject=adith&type=audio`, `/books`, `/books?q=Caliphs&scholar=dr-yusuf-karim`, `/books?subject=fiqh&type=book` alle via `curl /api/contents?...` én vite proxy `5173/api/contents` getest; kaarten, loading skeletons, empty `No lectures match — Clear all`, error `Try again`, reset en share-URL tonen correct.

---

## 6. URL-deelbaarheid

- Voorbeeld lecture-share: `/lectures?q=Qur&scholar=shaykh-usman-rahman&subject=quran-and-tafsir&type=audio`
- Voorbeeld book-share: `/books?scholar=dr-aisha-mahmoud&subject=adith&type=book&q=Gardens`
- `q`, `scholar`, `subject`, `type` staan in `URLSearchParams`; `setSearchParams` met `replace:true` voor debounce, `replace:false` voor chip-klik (history). `share this URL` hint onder filters. Direct bezoek met URL initialiseert filters zonder extra klik.

---

## 7. Niet gedaan

- Geen nieuwe auth, geen religieuze symbolen
- Geen wijziging aan `archive.service.ts` / `youtube.service.ts` / import routes
- Geen tweede zoek-engine (Typesense/Meilisearch/Elastic)
- Geen client-side duplicate filtering — server is single source
- Geen migratie van bestaande `Content` data-model (alleen indexen)

---

## 8. Open issues / vervolg

- **Diacritic & transcriptie**: `q=Tafsir` zonder ī matcht niet `Tafsīr Foundations` (contains is diacritic-gevoelig). Voor productie: `unaccent` extension of normalisatie in query (Fase 3).
- **Pagination UI**: API pagineert (`page/limit/totalPages`) maar frontend vraagt `limit=100` zonder paginator — schaalt tot ~100, daarna echte paginatie nodig.
- **Meervoudige scholar/subject chips**: backend ondersteunt komma-lijst, frontend staat nu single-select per categorie; multi-select chips is volgende UX-stap (filter met `scholar=a,b` blijft al server-side werken).
- **YouTube test cleanup vs seed**: `youtube.test.ts` delete `provider=youtube externalIdentifier=dQw4w9WgXcQ` — raakt seed `Opening the Qurʾān`; na draaien `npx tsx src/seed.ts` herstelt 10/15 — documenteren voor CI.
- **Build size 611 kB singlefile**: inclusief alle routes; code-splitting (`React.lazy` / `manualChunks`) is Fase 3.

STOP na Fase 2D.
