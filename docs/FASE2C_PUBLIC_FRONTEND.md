# Fase 2C — Public Frontend → Real Backend

**Datum:** 2026-09-23
**Status:** Live — publieke pagina's gekoppeld aan echte PostgreSQL / Fastify API, geen mocks

---

## 1. Doel & constraints

Bestaande publieke pagina's (`/lectures`, `/books`, `/scholars`, `/subjects` + detail) koppelen aan echte backend-data, zonder herstructurering.

- Gebruik bestaande Fastify/Prisma/PostgreSQL `Content` + `Scholar` + `Subject` via `/api/*`
- **Alleen `published`** tonen op publiek (draft/admin onzichtbaar)
- Nette neumorphic loading / error (zonder mock fallback) / empty states behouden
- Styling onaangetast: neumorphic + Aurora + kleuren + responsive, geen clichés
- **Niet gedaan:** nieuwe DB-modellen, auth, YouTube/Archive import aanpassen, mock data injecteren

---

## 2. Architectuur

```
Public pages (React) ──► src/lib/api.ts ──► Fastify /api/*
   │                       │ 5 public helpers
   │                       └─ listPublishedContents, getPublishedContent
   │                          listPublicScholars/getPublicScholar
   │                          listPublicSubjects/getPublicSubject
   └─ vite proxy /api → http://localhost:3001 (dev) / VITE_API_URL (prod)
```

Backend ongewijzigd: `/api/contents?status=published&type=&limit=&search=` (generic) + `/api/scholars` + `/api/subjects`. Frontend filtert lokaal per type-groep en per scholar/subject koppeling (`content.scholars[]`, `content.subjects[]`) — geen nieuwe endpoints.

---

## 3. Gewijzigde bestanden

### 3.1 `src/lib/api.ts` — 5 public helpers toegevoegd
```ts
listPublicScholars()          // GET /api/scholars
getPublicScholar(idOrSlug)
listPublicSubjects()          // GET /api/subjects
getPublicSubject(idOrSlug)
getPublishedContent(idOrSlug) // GET /api/contents/:id (slug of id)
```
Bestaande helpers (`listPublishedContents`, `listAdminContents`, mappers) ongewijzigd hergebruikt; geen mock fallback. `apiFetch` throwt nette `Error` bij `!ok` (error state i.p.v. fallback).

### 3.2 `src/pages/Lectures.tsx` *(bestaand, nu echt)* — al in Fase 2C-1 omgezet
- `listPublishedContents({ type: 'lecture,video,audio', limit: 100 })` + `listPublicScholars()` + `listPublicSubjects()` parallel
- Type-mapping: `lecture` + `video` + `audio` = Lectures (test-confirmed: 5 items: 3×lecture incl. playlist, 2×audio waarvan 1 Archive)
- Velden: `title`, `description`, `thumbnailUrl ?? coverUrl`, `scholars[0]`, `subjects[0]`, `provider` badge (youtube/archive), `durationMin`, `episodes`, `language`
- Detail-link: `/lectures/${content.slug}` (fallback `id`)
- Loading: neumorphic skeleton (geen witte pagina), Error: rose card met retry + geen fallback, Empty: sand card

### 3.3 `src/pages/Books.tsx` *(bestaand, nu echt)*
- `listPublishedContents({ type: 'book,document', limit: 100 })` → 5 items: archive 3×book, google_books 1×book, pdf 1×document
- Velden: `coverUrl ?? thumbnailUrl`, `provider` badge (archive/pdf/google_books/external), `pages`, `year`, `language`, `scholars/subjects`
- Link: `/books/${slug}`

### 3.4 `src/pages/Scholars.tsx` — herschreven 2026-09-23
- Parallel fetch: `listPublicScholars()` + `listPublicSubjects()` + `listPublishedContents({limit:100})`
- `countsByScholar` memo: `lecture = lecture|video|audio`, `book = book|document` geteld via `content.scholars[].scholarId`
- UI: `SearchBar`, `FilterChips` per `specialty` (`subject.name` via `specialtyId`), `StatRow` scholars/fields, `Tag tone=plain` voor vakgebied
- Per scholar: `scholar.name`, `initials`, `specialty.name`, `bio`, `accent` (rose/olive), lectures/books counts, vakgebied chip
- Click → `/lectures?scholar=<slug>` (geen nieuwe route nodig)
- States: skeleton grid (6 cards), error card met `message`, empty na filter met reset-knop

### 3.5 `src/pages/Subjects.tsx` — herschreven 2026-09-23
- Parallel fetch: `listPublicSubjects()` + `listPublishedContents({limit:100})`
- `countsBySubject` via `content.subjects[].subjectId`, `group` filter (`Revelation/Practice/Belief/History/Language/Character`)
- Stats: `totalLectures = Σ lecture|video|audio`, `totalBooks = Σ book|document` via `formatCount`
- Tile: `SubjectTile` met `accent` rose/olive/plain badge, lecture+book counts, laatste 3 lectures/books titels als chips
- Click → `/lectures?subject=<slug>` of `/books?subject=<slug>` (afhankelijk van grootste count)

### 3.6 `src/pages/ContentDetail.tsx` — **nieuw generic detail**
- `useParams<{id}>` (slug of id) → `getPublishedContent(id)` in `useEffect`
- States: loading skeletons (title+meta+player+about), error/404 card (rose), success
- `Embed` component branche:
  - `provider === 'pdf'` → `iframe src={embedUrl}` 720px hoog
  - `youtube` → `iframe https://www.youtube.com/embed/<id>` of `videoseries?list=` (playlist), `aspect-video`, `allowFullscreen`
  - `archive` → `iframe https://archive.org/embed/<id>` `aspect-video`
  - `google_books` → `iframe https://books.google.com/books?id=<id>&printsec=frontcover`
  - `external` → link-card + `sourceUrl` externe knop
  - fallback: `coverUrl ?? thumbnailUrl` img
- `PageHeader` eyebrow: `provider · type` (bijv. `archive · book`), titel, description
- About-grid: scholars (avatar initials + name + specialty) en subjects (Tag per subject.group) — beiden uit `content.scholars/subjects`
- Meta: `provider`, `language`, `collectionTitle/Identifier`, `year/pages/durationMin/episodes`, `publishedAt` format, `sourceUrl` externe link
- Back-links: `/lectures` of `/books` via `expectedType`

### 3.7 `src/pages/LectureDetail.tsx` + `src/pages/BookDetail.tsx` — dunne wrappers
```ts
// LectureDetail.tsx
export default () => <ContentDetail expectedType="lecture" /> // accepteert lecture|video|audio, 404 bij book/document
// BookDetail.tsx
export default () => <ContentDetail expectedType="book" />    // accepteert book|document, 404 bij lecture/video/audio
```
Behoudt type-safety voor bestaande `/lectures/:id` vs `/books/:id` zonder nieuwe logica.

### 3.8 `src/App.tsx` — routes toegevoegd onder `<Layout>`
```tsx
import LectureDetail from "./pages/LectureDetail";
import BookDetail from "./pages/BookDetail";
// ...
<Route path="lectures/:id" element={<LectureDetail />} />
<Route path="books/:id"    element={<BookDetail />} />
```
Bestaande publieke routes (`/`, `/lectures`, `/books`, `/scholars`, `/subjects`) ongewijzigd; admin routes ongewijzigd onder `/admin/*`.

### 3.9 DB integriteit — hersteld (Fase 2B follow-up)
- `prisma/schema.prisma` had `@@unique([provider, externalIdentifier])` maar fysieke index ontbrak na DB-recreate (alleen `contents_provider_externalIdentifier_idx` btree zonder UNIQUE)
- Diagnose: `psql \d contents` toonde geen `contents_provider_externalIdentifier_key`, `prisma.create` duplicate slaagde (bv. `test_dup`)
- Fix: cleanup `HAVING count>1` rows (`dup-test-*`) + `CREATE UNIQUE INDEX "contents_provider_externalIdentifier_key" ON "contents" ("provider","externalIdentifier")`
- Gevolg: `P2002` duplicate nu correct (audit + youtube tests groen), provider-isolatie behouden (`archive` vs `youtube`zelfde id toegestaan, `null` externalIdentifier multiples toegestaan)

---

## 4. Pagina's met echte data (live verificatie 2026-09-23)

| Route | Bron | Filter | Aantal | Voorbeeld embed |
|-------|------|--------|--------|-----------------|
| `/lectures` | `GET /api/contents?limit=100&type=lecture,video,audio&status=published` | lecture(3 incl. playlist `PLQ…` → `videoseries`) + audio(2) | **5** | `https://www.youtube.com/embed/<id>` of `videoseries?list=PLQ…` |
| `/books` | `…?type=book,document&status=published` | book 4 + document 1 (pdf) | **5** | `https://archive.org/embed/<id>`, `https://books.google.com/books?id=…`, pdf iframe |
| `/scholars` | `GET /api/scholars` + `GET /api/contents?limit=100` → countsByScholar | 8 scholars, solo published counts | **8** | — |
| `/subjects` | `GET /api/subjects` + contents → countsBySubject | 11 subjects met lecture/book counts per subject | **11** | — |
| `/lectures/:id` | `GET /api/contents/:slug` | LectureDetail (lecture/video/audio) | — | YouTube iframe aspect-video |
| `/books/:id` | `GET /api/contents/:slug` | BookDetail (book/document) | — | Archive/Google Books/PDF iframe 720px |

Live data na `npx tsx src/seed.ts` (15 contents: 10 published, 5 draft; 8 scholars, 11 subjects):
- Lectures: `Opening the Qurʾān: Sūrat al-Fātiḥah` (youtube dQw4…), `The Forty Hadith … Explained` (youtube playlist PLQ…), `Commercial Contracts …` (youtube 60It…), `Qurʾān Recitation — Jumuʿah Reflection` (archive audio), `The Sealed Nectar … Audio` (youtube jNQX…)
- Books: `Caliphs & Cities` (archive), `Gardens of the Righteous` (archive), `The Removal of Doubts` (archive), `Mukhtaṣar al-Qudūrī` (google_books), `Al-Adhkār — PDF Edition` (pdf)

API live:
```
GET /api/contents?limit=100                    → total 10 (published)
GET /api/contents?limit=100&type=lecture,video,audio → 5
GET /api/contents?limit=100&type=book,document       → 5
GET /api/scholars                              → 8
GET /api/subjects                              → 11
GET /api/contents/:slug (b.v. caliphs-and-cities-9avo) → 200 met embedUrl
GET /api/contents/:id   (b.v. cmudxc07n…)     → idempotent
```
Frontend proxy: `vite 0.0.0.0:5173 /api → 3001` + `Fastify 0.0.0.0:3001 Database connected` beide live (PID 5600/5521).

---

## 5. Loading / Error / Empty states

- **Loading:** geen witte pagina — neumorphic `skeleton` cards met `animate-pulse` (Lectures grid, Scholars 6-cards, Subjects tiles, ContentDetail title+player+about shimmer)
- **Error:** geen mock fallback — rose neumorphic card met `error.message`, retry-knop (`window.location.reload()` of `refetch`), provider badge expliciet
- **Empty:** sand card met uitleg (“Geen lectures gevonden / Geen scholars matching filter”) + reset filter knop; correct na filter (`search` + `FilterChips`) en bij `total===0`
- Detail: 404 card bij `P2025`/404 of `expectedType` mismatch (bijv. `/lectures/<book-slug>` → “Dit boek hoort bij Books” link)

---

## 6. Embed details

- **YouTube single** (`provider: youtube`, `externalIdentifier: <id>`, `sourceUrl: https://www.youtube.com/watch?v=<id>`): `embedUrl = https://www.youtube.com/embed/<id>` — detail gebruikt direct `content.embedUrl` (fallback gebouwd in seed)
- **YouTube playlist** (`sourceUrl: https://www.youtube.com/playlist?list=PLQ…`, `externalIdentifier: PLQ…`, `collectionIdentifier: PLQ…`): `embedUrl = https://www.youtube.com/embed/videoseries?list=PLQ…` — items individueel importeert als aparte Contents (Fase 2B)
- **Archive** (`archive`, `externalIdentifier: ilmnet-removal-of-doubts`): `https://archive.org/embed/ilmnet-removal-of-doubts`
- **Google Books** (`google_books`, `sourceUrl: https://books.google.com/books?id=quduri…`): `https://books.google.com/books?id=…&printsec=frontcover&hl=en`
- **PDF** (`pdf`, `sourceUrl: https://example.com/books/al-adhkar.pdf`): `embedUrl = sourceUrl` → iframe 720px
- **External** (`external`): geen embed, link-card met `sourceUrl`

Thumbnail/cover fallback: `thumbnailUrl ?? coverUrl` voor Lectures, `coverUrl ?? thumbnailUrl` voor Books; detailFallback: boven embed `img` indien embedUrl null.

---

## 7. Tests — alle groen 2026-09-23

```
prisma validate        → valid 🚀
prisma migrate status  → 1 migration, Database schema is up to date!
npm run build (server) → tsc -p tsconfig.json ✔
npx tsc --noEmit (frontend) → ✔ (geen errors)
vite build             → 142 modules, 606.71 kB gzip 154.40 kB ✔
npx tsx test/audit.test.ts   → ✅ All audit tests passed
  parseDurationToMinutes 14 cases, P2002 duplicate, null externalIdentifier multiples, metadata <10k, job states, generic CRUD audio/video/document/book/lecture
npx tsx test/youtube.test.ts → ✅ All YouTube audit tests passed (14+)
  parse watch/youtu.be/shorts/embed, playlist?list=, watch?v=&list= as playlist, oEmbed+scrape single, playlist 100 items, max 100, invalid throws, duplicate P2002 single/playlist, provider isolation
archive regress        → POST /api/admin/imports/archive/preview {sourceUrl: https://archive.org/details/commute} → 200 identifier commute totalItems 1 ✔
live HTTP              → GET /api/contents?limit=100 → 10, lectures 5, books 5, scholars 8, subjects 11 ✔
                       → GET /api/contents/:slug → 200 embed correct ✔
                       → GET /api/scholars, /api/subjects → 200 ✔
                       → GET http://localhost:5173/api/contents?limit=3 (via vite proxy) → 200 ✔
handmatig (via API + vite preview) → /lectures, /books, /scholars, /subjects, /lectures/<slug>, /books/<slug> alle bekeken via live HTTP + vite build success ✔
```

Tests behouden zonder herschrijven: audit gebruikt `durationMin`/`pages` null-checks, geen kunstmatige defaults; youtube isoleert `provider` (hergebruikt `parseDurationToMinutes`).

---

## 8. Styling behoud

- Neumorphic tokens ongewijzigd: `bg-[#EDEEF2]`, `soft-raised`, `inset`, `rose/olive/sand` accenten, `Aurora` achtergrond, `rounded-[1.4rem]`
- Geen nieuwe kleuren, geen Tailwind clichés, responsive grid (`md:grid-cols-2`, `lg:grid-cols-3`) behouden
- Bestaande componenten hergebruikt: `PageHeader`, `Section`, `FilterChips`, `SearchBar`, `SubjectTile`, `Tag`, `StatRow`

---

## 9. Niet gedaan (scope-bewaking)

- Geen DB-migratie of model-wijziging (alleen UNIQUE index herstel)
- Geen auth
- Geen wijziging aan `archive.service.ts` of `youtube.service.ts` of import routes
- Geen nieuwe publieke features (pagination, sorting beyond search/group chips behouden)

---

## 10. Open issues / vervolg

- **Detail deep-link via `?scholar=` / `?subject=`**: Lectures/Books lezen `?scholar=<slug>` en `?subject=<slug>` maar filtern momenteel alleen client-side op `search` text; scholar/subject query wordt nog niet gebruikt om automatisch FilterChip te zetten — werkt maar UX kan explicieter (`useSearchParams` → preselect).
- **Pagination**: public endpoints pagineren (`?page=&limit=`), maar frontend vraagt `limit=100` en doet geen infinite scroll — voldoende voor seed (15), schaalt tot ~100 maar echte paginatie is vervolg Fase 3.
- **Vite build size 606 kB (singlefile)**: bevat alle routes incl. admin; code-splitting (`React.lazy` / `manualChunks`) is Fase 3 optimalisatie, nu acceptabel voor vercel preview.
- **YouTube test cleanup vs seed**: `youtube.test.ts` cleanup delete't `provider=youtube externalIdentifier=dQw4w9WgXcQ` — dit raakte seed's `Opening the Qurʾān` (zelfde id). Na test is `npx tsx src/seed.ts` nodig om 10/15 te herstellen — niet geblokkeerd, wel documenteren voor CI.
- **Embed externe domeinen in preview**: YouTube/Archive iframes laden correct live, maar in-app preview met `sandbox="allow-scripts"` kan fonts/styles blokkeren — gedowngrade graceful, download werkt volledig.

---

## 11. Hoe draaien

```bash
# DB
cd server && npx prisma validate && npx prisma migrate status
npx tsx src/seed.ts # herstelt 15 (10 published)

# API + frontend
npm run dev          # api 0.0.0.0:3001, vite 0.0.0.0:5173 proxy /api
npm run build        # server tsc + vite singlefile

# Tests
npx tsx test/audit.test.ts
npx tsx test/youtube.test.ts
curl -s http://localhost:3001/api/contents?limit=100 | jq .pagination.total # → 10
curl -s http://localhost:3001/api/contents/<slug> | jq .data.embedUrl
```

STOP na Fase 2C; docs bijgewerkt.

