# ilmNet — Discovery Experience Plan

**Status:** plan only. Nothing in this document has been implemented. No code, dependency, database
or design change is part of it.
**Date:** 26 September 2026
**Repository state used:** local `master` = `a8f1a88` (audit doc) on top of `5d7c26f` (Fase 6.1);
the plan was written against the local worktree, which is identical to GitHub `master` for every
file except `docs/LIBRARY_UX_AUDIT.md` (local only) and `docs/spotify_desiign.md` (GitHub only,
fetched read-only from `https://raw.githubusercontent.com/mrmiagy82/ilmNET_V7/master/docs/spotify_desiign.md`).
**Reference read in full:** `docs/spotify_desiign.md` (868 lines, 31 829 B, remote commit `6d67ad5`),
`AGENTS.md`, `docs/CONTEXT.md`, `docs/LIBRARY_UX_AUDIT.md`, and the current public code
(`src/pages/*`, `src/components/*`, `src/lib/*`, `server/src/routes/*`, `server/prisma/schema.prisma`).

---

## 1. Scope and non-negotiables

**Goal:** make ilmNet a much more interesting content library **without** replacing its branding or
design language. Spotify is used as inspiration for *discovery UX only*.

Explicitly preserved (checked as constraints for every idea below):

| Must stay | Where it lives today |
| --- | --- |
| IlmNet brand, logo SVGs, tagline | `public/brand/logo/*.svg`, `src/components/Brand.tsx` |
| Cream/sand/olive/rose palette, official tokens | `src/index.css` `@theme` (`--color-brand-bg #f3ebdd`, `--color-olive #A2AB73`, `--color-rose #CC3A63`, …) |
| Neumorphic/spatial character (`neu-raised`, `neu-inset`, rounded 22–44 px surfaces) | `src/index.css` `@utility` block |
| Typography (Plus Jakarta Sans + Inter, self-hosted) | `src/index.css` `@font-face`, `public/fonts/` |
| Backend architecture (Fastify + Prisma + PostgreSQL, one generic `contents` table) | `server/src/routes/*`, `server/prisma/schema.prisma` |
| Content model (no new tables/columns needed for the first build) | `Content`, `Scholar`, `Subject`, join tables |
| No TinyCMS, no content layer for UI strings | `AGENTS.md` §2, `docs/CONTEXT.md` §7d |
| No religious decorative symbols, no invented content or numbers | `AGENTS.md` §2 |

Explicitly **not** taken from Spotify: its dark palette (`#000000`/`#121212`/`#1f1f1f`), its green
(`#1ed760`), its type system (SpotifyMixUI, 11–24 px), its radii (6 px cards / 9999 px pills), its
fixed 340 px sidebar shell, its shadow philosophy, its promo gradient banner, and any of its
branding or iconography. ilmNet keeps its own light, warm, spatial surface language; the Spotify
document is used for **layout pattern and discovery logic**, never for colour, type or shape values.

---

## 2. What `docs/spotify_desiign.md` actually contains (and what is transferable)

The document is a **style/token extraction** (the header says so: "Source measurements are
normalized; roles and recommendations are interpreted"), not an interaction spec. Its contents:

- Colour tokens and surfaces (canvas → sidebar → card → card-hover), typography tokens, 4 px spacing
  scale, radii, shadows, and a `:root`/`@theme`/JSON dump of the same values.
- Component descriptions: pill button, ghost text button, **square album card**, **circular artist
  card**, **sidebar "Your Library" panel**, **top navigation bar with a search field**, **section
  header ("Trending songs") with a "Show all" link**, promotional banner, search input, nav arrows.
- Layout: fixed two-column shell, **horizontal card carousels**, compact section spacing (32–48 px),
  and the "geometry rhythm" — square covers → circular artist avatars → square tiles, alternated so a
  long feed signals a content-type change without dividers.

**Transferable to ilmNet (UX-level only):**

1. **Horizontal rails** with an explicit section title and a "Show all" affordance.
2. **Several different sections stacked on one page**, each answering a different question ("new",
   "series", "by scholar", "by subject", "to read", "to listen").
3. **Geometry rhythm as a navigation aid** — ilmNet already owns three card shapes: book covers
   (`aspect-[3/4]`), lecture/video thumbs (`aspect-[16/10]`) and circular scholar avatars
   (`rounded-full` in `Scholars.tsx:15`). Alternating them between rails gives the same effect with
   zero new visual language.
4. **One search entry point in the shell** (Spotify: top bar) instead of per-section search only.
5. **A "Your Library" surface** — for ilmNet this can only ever be *device-local* (see §4), never an
   account.
6. **Dense, calm cards with secondary metadata in a muted tone** — ilmNet already does this
   (`Tag`, `text-ink-muted` meta rows).

**Not transferable / rejected:** dark canvas, green accent, the two-column shell, the promo banner,
autoplay-style urgency ("Trending", "Made for you"), and any invented engagement metric.

---

## 3. What the code can already do (measured inventory)

This section is the factual base for §4. Everything here was read from the repository.

### 3.1 The API already covers almost everything discovery needs

`GET /api/contents` (and `/api/v1/contents`) — `server/src/routes/content.ts`, query schema in
`server/src/lib/validation.ts:60-74`:

| Parameter | Reality |
| --- | --- |
| `type` | comma-separated list via `parseListParam` (e.g. `lecture,video,audio`) — `content.ts:99-103` |
| `provider` | comma-separated, normalised (`youtube`, `archive`, `google_books`, `pdf`, `external`) |
| `language` | exact match filter |
| `collection` | **exact, index-backed** filter on `collectionIdentifier` (Fase 5.4) |
| `q` | `ILIKE %q%` across **nine** fields: title, description, slug, collectionTitle, collectionIdentifier, series, language, scholar name, subject name (`content.ts:121-137`) |
| `scholar` | one or more slugs/ids/names (`content.ts:138-148`) |
| `subject` | one or more slugs/ids/names (`content.ts:149-158`) |
| `page`, `limit` | **real server-side pagination**; `limit` max 100, default 20; response carries `pagination { page, limit, total, totalPages }` (`content.ts:169-199`) |
| `sort` | `field:dir` with allowed fields **`createdAt`, `updatedAt`, `publishedAt`, `title`, `year`** (`content.ts:160-167`); default is `updatedAt:desc` |

Other public reads: `/api/contents/:id|slug` (detail, full public shape), `/api/scholars` (list with
`bio` + `specialty` — `public-payload.ts` `PUBLIC_SCHOLAR_KEYS`), `/api/scholars/:slug` (detail, heavy:
1 011 kB measured for a scholar with ~600 records in Fase 5.4), `/api/subjects`, `/api/subjects/:slug`,
`/api/health`, `/api/ready`.

### 3.2 What this means immediately

- **"New" is a real, indexed question today**: `sort=publishedAt:desc` (index `[status, publishedAt]`
  exists) — no backend work.
- **"Paging" already exists** and the public UI simply never uses it: the eight hard-coded
  `limit: 100` calls (`src/pages/{Lectures,Books,Scholars,Subjects,SeriesDetail,SubjectDetail}.tsx`,
  `src/components/Subjects.tsx`) ignore `pagination.totalPages`. *Load more / paging is therefore a
  frontend-only change*, and so is showing real totals (`pagination.total` with `limit=1`, the pattern
  the hero already uses in `src/components/Hero.tsx:84-105`).
- **Cross-type search is already possible**: `q=` searches nine columns including scholar and subject
  names, and returns mixed types when no `type` filter is set. A global search page needs **no**
  backend endpoint — only grouping of the results client-side (by type, scholar, subject).
- **"More like this" is already possible**: `subject=<slug>` / `scholar=<slug>` with the current item
  filtered out.
- **Per-subject and per-scholar rails are already possible**: `subject=`/`scholar=` + `limit`.

### 3.3 What does **not** exist (and must not be faked)

| Missing signal | Evidence | Consequence |
| --- | --- | --- |
| **Any popularity signal** (plays, views, likes, saves) | repo-wide grep for `viewCount`/`playCount`/`statistics`/`trending`/`likes` returns nothing in `src/` or `server/src/`; the YouTube importer stores `metadata.youtube.{videoId, playlistId, title, channel, publishedAt, year, duration, thumbnail, youtubeUrl, importedFrom, importedAt, jobId}` (`server/src/routes/import.ts:483-500`) — no statistics | **"Popular"/"Trending" cannot be honest.** No such rail in the plan unless a real signal is added later (§6, B4) |
| **Editorial curation flag** | no `featured`/`pinned` column anywhere in `schema.prisma` | "Curated by ilmNet" needs either a new column + admin field, or a documented convention in `metadata` (content `metadata` is public, scholar/subject metadata is not — `public-payload.ts`) |
| **Series episode order** | the importer stores no index/position; `Content` has `episodes Int?` (a hand-entered count in the admin, `src/admin/LectureForm.tsx:494`) but nothing links it to member records | Real "Episode 3 of 12" ordering needs a stored position (see §6, B5) |
| **Collections overview** | no endpoint lists distinct `collectionIdentifier`s; the UI only knows collections that appear in a loaded content page (`src/lib/series.ts` `groupByCollection`) | A "Series" rail built from a 100-item window is honest only about that window; a complete series index needs a small endpoint (§6, B1) |
| **Any per-user state** | the public app writes nothing to `localStorage`/`sessionStorage` (`grep` in `src/`: only the admin comments that it stores *no* credential) | Anything personal is device-local at best; nothing syncs, nothing follows an account |

---

## 4. Feature-by-feature assessment

Legend — **1) already possible** (endpoints + components suffice), **2) frontend-only** (needs new
client code, no server/db change), **3) backend/API needed**, **4) data available**, **5) impossible
without accounts**.

### 4.1 Home / Landing — multiple content sections

| | |
| --- | --- |
| 1 | Hero already renders real totals via `limit=1` + `pagination.total` (`Hero.tsx:84-105`); `Library` section is static marketing copy (`components/Library.tsx`); `Subjects` block already ranks subjects by real item counts (`components/Subjects.tsx:62-77`) |
| 2 | **Yes — entire feature.** Rails are horizontal lists of existing cards + "Show all" links. Needed: a `Rail` primitive (scroll-snap container, skeleton, empty-hides-itself), shared card components, and a section order |
| 3 | None for the first build |
| 4 | `type`, `sort=publishedAt:desc`, `subject`, `scholar`, `collection`, `limit`, and `pagination.total` |
| 5 | Nothing on this page needs an account |

Proposed Home sections (each one request, each independently failing):

1. **Hero** (unchanged — brand + real counts + primary CTA)
2. **New in the library** — `sort=publishedAt:desc&limit=12`, mixed cards *(square/16:10 rhythm)*
3. **Continue where you left off** — device-local only, appears only if this device has history (§4.5)
4. **Listen** — `type=audio,video&sort=publishedAt:desc&limit=12` → "Show all" → `/lectures?type=audio`
5. **Read** — `type=book,document&sort=publishedAt:desc&limit=12` → `/books`
6. **Series to start** — from §6 B1 when it exists; until then the honest interim in §6 B1-alt
7. **Scholars** — real scholars (fixes audit A1: the block currently shows *subjects* on a scholar
   heading) → each card to `/scholars/<slug>` (§4.4)
8. **Subjects** — keep the existing ranked subject block, now linking to the subject page *and* the
   filtered list
9. **How it works / final CTA** (unchanged)

This keeps the landing page's existing rhythm (big statement → shelf block → closing) and adds
Spotify's "several rails, each a different question" without touching the visual language.

### 4.2 Library (the browse surface)

| | |
| --- | --- |
| 1 | `/lectures`, `/books`, `/scholars`, `/subjects` all have real loading/error/empty states, URL-synced filters and a sticky filter panel (see `docs/LIBRARY_UX_AUDIT.md` §1.3) |
| 2 | **Yes.** Add: a "New in this section" rail above the grid, server-side paging ("Load more" using `page` + `totalPages`), real totals from `pagination.total`, and a "Series in this view" strip built from `groupByCollection` over the loaded page |
| 3 | None for paging (the API already pages). A complete *series index* would need B1 |
| 4 | `pagination.total`/`totalPages`, `sort`, `page` |
| 5 | Nothing |

Note: the word "Library" in the brand copy currently means the three shelves; the real browse
surfaces are the four list routes. This plan does not rename anything — it adds sections to what
exists.

### 4.3 Series / collections

| | |
| --- | --- |
| 1 | `/series/:id` renders a collection via the index-backed `collection=` filter; `groupByCollection` derives series vs. standalone; series cards already exist on `/lectures`, `/books`, `/subjects/:id` |
| 2 | Partly: a "Series" index page, richer series cards, "next/previous in series", and a "continue this series" rail are all frontend work |
| 3 | Ordering and completeness are data problems: no stored episode position, and a series with >100 items exceeds one page (`limit` max 100). "Episode 3 of 12" and "watch the rest" need B5 (a position at import) and, for long series, paging (frontend) |
| 4 | `collectionIdentifier`, `collectionTitle`, member items, `provider` (YouTube playlist vs Archive collection) |
| 5 | Nothing, but see B5: the *honest* fix for ordering is an import-time change, not a UI trick |

Deliberate honesty rule for this plan: **no invented numbering.** Until B5 lands, the series page must
not print "01, 02, 03" over an alphabetical list (audit A3) — either keep the current ordering *and*
label it (e.g. "as imported"), or sort by `createdAt:asc` (import order) and describe it as such.

### 4.4 Scholars

| | |
| --- | --- |
| 1 | `/api/scholars` returns every published scholar **with `bio` and `specialty`**; `/api/contents?scholar=<slug>` filters their work; `/api/scholars/:slug` exists but is heavy (1 011 kB measured) |
| 2 | **Yes — a scholar hub page is frontend-only** using the light list payload + the scholar filter (no need for the heavy detail endpoint). Today the tiles link to `/lectures` *without* a filter and there is no scholar route at all (audit A1/A2) |
| 3 | Optional later: `_count` of published contents per scholar in the list payload (B2) so tile counters are exact instead of derived from a 100-item window |
| 4 | name, initials, bio, specialty, accent — all public |
| 5 | Nothing; "follow a scholar" (notifications, saved list) would need accounts and is out of scope |

### 4.5 "Continue" and "recently viewed" (device-local)

| | |
| --- | --- |
| 1 | Nothing exists. `AudioPlayer` already tracks real playback position and duration (`AudioPlayer.tsx:50-75`) but keeps it in component state only |
| 2 | **Yes — frontend-only**, in one new module (e.g. `src/lib/localActivity.ts`) writing to `localStorage`: last N opened items + last position for audio (anonymised to ids/slugs/timestamps) |
| 3 | None |
| 4 | The item ids/slugs the visitor actually opened, and the real `currentTime` from the player |
| 5 | **Cross-device** history, "resume on another device", and anything personal beyond this browser need accounts — explicitly out of scope |

Guard rails that make this honest rather than the removed fake "Continue where you left off"
(`docs/CONTEXT.md` §7b): the rail is *absent* when there is no history, it is labelled as
device-local ("On this device"), it stores nothing but ids + timestamps, it is clearable by the
visitor, it never claims a progress percentage the player did not measure, and it is never presented
as an account feature. This is a **decision for the owner** (§7, Q1) because it is the one item that
touches the "no invented state" rule in spirit even though the data is real.

### 4.6 "Popular" / "Trending"

| | |
| --- | --- |
| 1 | No |
| 2 | No — there is no real signal to visualise |
| 3 | A real signal needs new data: either (a) an editorial list maintained by the operator (no telemetry, no privacy cost), or (b) anonymous aggregate counters per content (new table + a write path from the player + privacy documentation) |
| 4 | Nothing exists today (grep evidence in §3.3) |
| 5 | Per-person ranking ("because you listened to…") needs accounts |

**Recommendation:** do not ship a "popular" rail in the first build. If the owner wants it, start with
(a) — an editorial "Featured" set — because it is honest, cheap and needs no telemetry.

### 4.7 Search

| | |
| --- | --- |
| 1 | `q` already searches nine fields including scholar and subject names; per-section search fields exist (with accessible names, Fase 5.6.1) |
| 2 | **Yes** for: a global search route (`/search?q=`), result grouping by type/scholar/subject, suggestions from loaded lists, and a header entry point. No new endpoint required |
| 3 | Optional later: relevance ordering is `updatedAt:desc` today; a real relevance rank (title > description) or trigram index is a backend item (audit §8.16 / `docs/CONTEXT.md` §8.16) |
| 4 | title, description, scholar names, subject names, collection titles, language |
| 5 | Personalised search history/"recent searches" would be device-local at best |

### 4.8 Detail pages (content)

| | |
| --- | --- |
| 1 | Embed/player, downloads, series block, About panel, scholars/subjects, real metadata |
| 2 | **Yes**: "More like this" (same subject/scholar, current item excluded), "Next in this series" (when order is known), "Continue from 12:34" (device-local), and a slimmer artwork block (audit C1/C4) |
| 3 | Only for ordered series (B5) |
| 4 | All filters needed for "more like this" already exist |
| 5 | Nothing |

### 4.9 Not possible without personal accounts (explicit list)

`Favourites/saved library`, `follows`, `your playlists`, `because you listened to…`,
`cross-device resume`, `notifications for new items`, `shared/collaborative collections`, and any
`personalised home`. Each would require identity, a user table, auth for visitors and a privacy
policy change — none of which fits "free, no-login library" (`AGENTS.md` §1). They are **not** in this
plan.

---

## 5. Per-page plan (what the build would touch)

| Page | Add | Keep exactly as is |
| --- | --- | --- |
| `/` Landing | 4–6 content rails (§4.1), scholar rail instead of the mislabelled scholar block, "Show all" links | Hero markup/aurora, the three-shelf `Library` block, `HowItWorks`, `FinalCTA`, brand placement |
| `/lectures`, `/books` | "Newest first" strip, "Series in this view" strip, "Load more" (paging), exact totals | Sticky filter panel, URL-synced filters, skeleton/error/empty states, card geometry |
| `/series/:id` | Series header card (provider, count, real order note), "start here" affordance, next/previous once B5 exists | The `collection=` filter (never `q=`), episode row layout |
| `/scholars` | Tiles link to the new scholar hub; counters honest or omitted | Grid, search, field chips |
| `/scholars/:slug` *(new)* | Hub: bio, specialty, their lectures/books/series rails, "Show all" → filtered lists | — (new page, built only from existing components) |
| `/subjects/:slug` | "Newest", "Series", "By scholar" rails inside the existing structure | Existing series/singles grouping |
| `/lectures/:slug`, `/books/:slug` | "More like this", "Continue from …" (device-local), series continuity | Player/embed/download behaviour, canonical redirect, metadata |
| `/search` *(new)* | Grouped results (Content, Scholars, Subjects, Series) with the existing card components | — |
| Nav | One search entry point (icon → `/search`), keeping the existing CTA logic | Logo size/placement, header height, mobile panel |

New shared building blocks (all frontend, no dependency):

- `Rail` — horizontal scroll-snap list, keyboard reachable, skeleton state, hides itself when empty,
  "Show all →" link in the section header.
- `SectionHeading` — the existing `SectionLabel` rhythm extended with the "Show all" slot.
- Shared card components extracted from the pages where they are currently duplicated
  (`LectureCard` `Lectures.tsx:20`, `SeriesCard` `Lectures.tsx:79`, `BookCard` `Books.tsx:42`,
  `CollectionCard` `Books.tsx:66`, `ContentCard`/`SeriesCard` `SubjectDetail.tsx:11,34`,
  `ScholarTile` `Scholars.tsx:8`) — this is the refactor that also removes the drift the audit
  measured (B3/B6/D6).
- `useContentQuery` — one hook around `listPublishedContents` with abort handling, `page`/`total`
  support and the "hidden on failure" contract the hero already follows.
- `localActivity` — the device-local store from §4.5, behind one module.

---

## 6. Backend / data options (none of them required for the first build)

Ordered by value per unit of risk. Each is **optional** and needs the owner's decision.

**B1 — Collections/series index (`GET /api/collections`).**
One grouped query: `groupBy collectionIdentifier` with published-only counts, a representative item
thumbnail/title and the provider. Enables a real "Series" rail and a `/series` index page, and fixes the
completeness claim in audit A4/C2. No schema change. ~1 route + validation + public-payload entry + tests.

**B1-alt — frontend-only interim (recommended first step).** Build the series rail from the newest
loaded page (e.g. 100 newest items), labelled as *"Series in the newest additions"* — true about what
it shows, and complete for small libraries. Upgrade to B1 when the library grows.

**B2 — Exact counters on scholars/subjects.** Add a published-content count to `/api/scholars` and
`/api/subjects` (Prisma `_count` with a `where`, or a small aggregate). Replaces the client-side
counting that can under-report past 100 items (audit A5). Must be added to `public-payload.ts` **and**
the tests, per the positive-list rule (`AGENTS.md` §2).

**B3 — Editorial "Featured".** Either a nullable `featured`/`featuredRank` column (migration) or a
documented `metadata.featured` convention for content (no migration, but the admin needs a field so an
operator can actually set it). Gives a real, honest "Picked by ilmNet" rail without telemetry.

**B4 — Popularity/telemetry.** A new `content_events` table (contentId, kind, timestamp, coarse
client hash) + a public write endpoint + privacy text. This is the only way to a *real* "Trending".
It changes the DB, needs rate-limiting and a privacy update (`docs/CONTEXT.md` §8.19/§8.20) — **not
recommended now**; revisit after launch with real traffic.

**B5 — Episode position.** Store the playlist/collection position at import time (a new
`position Int?` column, or `metadata.youtube.playlistIndex`) so a series can be ordered and
numbered honestly ("Episode 3 of 12", next/previous). Schema change + importer change + a backfill
question for existing rows.

**B6 — Search relevance / trigram index.** Only becomes necessary at library scale (§8.16). Ordering
by relevance instead of `updatedAt` is a small server-side change; the trigram index is a documented
host-side scaling step.

---

## 7. Decisions needed before the build (owner input)

- **Q1 — Device-local history: yes/no?** "Continue where you left off" on this device (real data,
  never synced) or nothing personal at all.
- **Q2 — Series rail now or after B1?** Frontend-only interim (B1-alt) first, or wait for the
  collections endpoint?
- **Q3 — "Featured" curation:** is an editorial rail wanted (needs B3 either way)?
- **Q4 — Search scope:** global `/search` page plus a header entry, or keep search inside sections?
- **Q5 — Series honesty:** until B5 exists, should the series page say "as imported" and drop
  sequential badges, or keep the current alphabetical order?

---

## 8. Implementation order for the actual build

Each step is independently shippable and independently verifiable. No step needs a new dependency, a
schema change or a redesign; steps D0–D5 are frontend-only.

**D0 — Foundations (no visible change).**
Extract the duplicated card components into shared, typed components; add `Rail`, `SectionHeading`
and `useContentQuery`; keep every existing page rendering byte-identically.
*Verify:* `npx tsc --noEmit` (root + `server/`) clean; `npm run build` succeeds;
`npm run test:e2e:production` and `test:e2e:brand` still green; no visual diff on the four list pages.

**D1 — Landing discovery rails.**
Sections 2, 4, 5 and 7 of §4.1 (new, listen, read, scholars), each hiding itself on failure or empty;
the mislabelled scholar block is replaced by real scholars (audit A1).
*Verify:* counts still come from the API (`limit=1` pattern); a rail with a failing request disappears
instead of showing an error card; mobile 390×844 has no horizontal page overflow (the existing e2e
mobile section covers this class of regression).

**D2 — Library rails + honest scale.**
"Newest first" strip and "Series in this view" on `/lectures` and `/books`; "Load more" using
`page`/`totalPages`; `StatRow` values from `pagination.total` (fixes audit A5 at the boundary where the
UI currently under-reports); one shared retry handler and visitor-readable error copy (audit B4/B5).
*Verify:* paging against a database with >100 published records; totals equal a direct
`count` on the API; empty/filtered states unchanged.

**D3 — Scholar hub + subject rails.**
New `/scholars/:slug` (light payload + `scholar=` filter), scholar tiles link to it (audit A2);
`/subjects/:slug` gains "Newest", "Series" and "By scholar" rails inside its current structure.
*Verify:* the heavy `/api/scholars/:slug` detail endpoint is not called by the hub; a scholar with no
published work shows an honest empty state.

**D4 — Global search.**
`/search?q=` grouped by Content / Scholars / Subjects, using the existing `q` search plus
`listPublicScholars`/`listPublicSubjects` for the non-content groups; header entry point; accessible
names on every new field (the Fase 5.6.1 contract).
*Verify:* a query matching a scholar name returns that scholar *and* their content; `/search` with no
results is an honest empty state; canonical/`noindex` behaviour matches the existing pages.

**D5 — Detail-page continuity.**
"More like this" (subject, then scholar, current item excluded), series next/previous **only** when an
order exists, slimmer artwork block when there is no real cover (audit C1/C4); plus the device-local
"Continue" affordance **if Q1 is answered yes**.
*Verify:* recommendations never include the current item or unpublished records; a book without a
cover does not render the 420 px empty frame.

**D6 — Series that behaves like a series.**
Series page ordering/numbering per the Q5 answer, "start from the beginning", position display;
optionally B5 for real numbering and B1 for the series index.
*Verify:* the badge order matches the order actually rendered; the completeness claim (audit C2) is
removed or true.

**D7 — Scale and curation (optional, decided after D1–D6).**
B2 (exact counters), B3 (editorial featured rail), then B6 when the library grows. B4 only if a real
popularity signal is ever wanted, with the privacy work it implies.

**Cross-cutting rules for every step:** only existing endpoints and components; no new dependency; no
schema change before the owner approves a B-item; every new rail must hide itself on failure or empty
state (never a plausible-looking `0` or a mock card); no Spotify colours/type/shape values; keep the
IlmNet brand, palette and neumorphic surfaces untouched; and `docs/CONTEXT.md` is updated after each
shipped step per `AGENTS.md` §0.

---

## 9. What this plan deliberately does not do

- No dark mode, no Spotify palette/green, no new typography, no 6 px/9999 px radius system, no sidebar
  shell, no promo banner, no third-party branding of any kind.
- No fake engagement: no "trending", no play counts, no "for you", no invented progress bars, and no
  placeholder cards while loading — the API's real answer or nothing (the rule that removed the fake
  "1.3k listens" in Fase 3.9.1 stays).
- No TinyCMS, no content layer for website strings, no new tables without an explicit owner decision.
- No accounts, no visitor login, no telemetry in the first build.
- Nothing that breaks the pinned browser contracts (`tests/e2e/production.spec.mjs`: footer links that
  resolve, accessible search names, brand assets at 1366/375/320 px, real embeds with real fallbacks,
  per-route metadata, canonical redirects).
