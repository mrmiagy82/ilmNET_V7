# ilmNet — Public Library UX/UI Audit

**Date:** 26 September 2026
**Revision audited:** `HEAD` = `5d7c26f` (Fase 6.1), branch `master`
**Nature:** read-only audit. No application code, dependency, database or design change was made.
Spotify is used in this document **only as a reference for how a modern content library solves
discovery**; the neumorphic cream/olive/rose design language is treated as fixed and is **not**
proposed for change here.

Every claim below points at the file and line it was read from. No numbers, counters or content are
invented; where a figure comes from the seed file or from an existing document, it says so.

---

## 1. Current situation (measured from the code)

### 1.1 Routes

`src/App.tsx:64-77` — the whole public site lives under one layout:

| Route | Page component | Purpose |
| --- | --- | --- |
| `/` | `pages/Landing.tsx` | Hero + Library + Subjects/Scholars block + How it works + final CTA |
| `/lectures` | `pages/Lectures.tsx` | Live list, filters in the URL |
| `/lectures/:id` | `pages/LectureDetail.tsx` → `ContentDetail` | Player/embed + About + series block + artwork |
| `/books` | `pages/Books.tsx` | Live list, filters in the URL |
| `/books/:id` | `pages/BookDetail.tsx` → `ContentDetail` | Reader/embed + About + series block + cover |
| `/series/:id` | `pages/SeriesDetail.tsx` | Episode list of one collection/playlist |
| `/scholars` | `pages/Scholars.tsx` | Scholar tiles with client-side search + field chips |
| `/subjects` | `pages/Subjects.tsx` | Subject tiles with group chips |
| `/subjects/:id` | `pages/SubjectDetail.tsx` | Series + single lectures + single books for one subject |
| `*` | `pages/NotFound.tsx` | Real 404 (Fase 5.5) |
| `/admin/*` | `src/admin/*` | Out of scope for this audit |

There is **no scholar detail route**. A scholar exists only as a tile in a list and as a byline on
content (`App.tsx:71` is the only scholar route).

### 1.2 Shared building blocks

- `components/Layout.tsx` — skip link, `Nav`, `<main id="main-content" tabIndex={-1}>`, footer, and a
  forced `window.scrollTo(0)` on every pathname change (`Layout.tsx:9-11`).
- `components/Nav.tsx` — fixed header, 4 primary links, one contextual CTA that swaps label per page
  (`Nav.tsx:58-67`), hamburger + panel below `md` (`Nav.tsx:68-102`).
- `components/PageHeader.tsx` — the shared page intro used by **every** subpage: eyebrow, title,
  intro, optional meta column, plus one `Aurora` WebGL backdrop (`PageHeader.tsx:24`).
- `components/ui.tsx` — `SearchBar`, `FilterChips`, `Tag`, `SectionLabel`, `EmptyState`, `StatRow`.
- `components/MediaThumb.tsx` — image frame with an always-rendered fallback layer behind the image,
  `loading="lazy"` unless `eager`, `onError` swap.
- `lib/series.ts` — `groupByCollection()` (series vs standalone), `getDownloadUrl()`,
  `getAudioStreamUrl()`.
- `lib/thumbnail.ts` — media priority: custom upload → provider image → placeholder.
- `lib/usePageMeta.ts` — per-route title/description/canonical/OG, `noindex` only on explicit states.
- `data.ts` — `subjectGroups`, `formatCount`, `formatDuration` (no placeholder content since Fase 3.9).
- `index.css` — self-hosted fonts, `@theme` tokens, neumorphic `@utility` classes, two keyframes
  (`drift`, `rise`), a reduced-motion block.

Size: public UI is **4,484 lines** across `src/pages`, `src/components`, `src/lib` (admin is 6,562).

### 1.3 Data flow and state handling

Every list page fetches on mount and on URL change with `limit: 100`, holds three local states
(`loading`, `error`, data) and renders one of three branches: skeleton → error card → content.
Filters live in the URL and are therefore shareable (`Lectures.tsx:150-154`, `Books.tsx:141-145`);
search input is debounced by 340 ms (`Lectures.tsx:160`, `Books.tsx:127`). `pagination.total` is
available from the API (`lib/api.ts:195`) and is used **only** on the landing page hero
(`Hero.tsx:96-97`) and inside the admin.

Loading, empty and error states exist everywhere and are separated into "no match (filters applied)"
versus "nothing published yet" (`Lectures.tsx:340-352`, `Books.tsx:316-331`) — a direct consequence
of the honesty rules in `AGENTS.md`.

---

## 2. What already works well (keep this)

1. **Honesty of the interface is real, not aspirational.** No mock content anywhere; the hero shows
   counts only after a real API answer and shows nothing on failure (`Hero.tsx:84-109`); empty states
   distinguish filter-exhaustion from an empty library; a failed provider image degrades to
   `AudioPlaceholder`/gradient instead of a broken frame (`thumbnail.ts`, `MediaThumb.tsx:42-61`).
2. **Consistent page skeleton.** `PageHeader` gives every subpage the same eyebrow/title/intro/meta
   rhythm, so the site feels like one publication rather than nine screens.
3. **URL as state.** Filters, search and collection identifiers are in the URL, so a filtered view can
   be shared or bookmarked (`Lectures.tsx:150-154`; `AGENTS.md` documents this as a contract).
4. **Card vocabulary is coherent.** Series/collection cards, episode rows, book covers and lecture
   cards are visually distinct but built from the same surface, radius and shadow scale
   (`neu-raised`, `neu-inset` in `index.css:185-223`).
5. **Metadata discipline.** Per-route title/description/canonical, `og:image` only when a real image
   exists, `noindex` only after a confirmed empty result (`usePageMeta.ts`, `ContentDetail.tsx:206-219`).
6. **Accessibility groundwork.** Skip link (`Layout.tsx:17-22`), `aria-label` on every search field
   (`ui.tsx:20-34`, Fase 5.6.1), `aria-hidden` on all decorative SVG, `role="status"` result counts on
   the two busiest lists, visible focus ring (`index.css:168-172`), reduced-motion CSS
   (`index.css:175-183`), self-hosted fonts with `font-display: swap`.
7. **The 404 and "content not found" states are real pages**, not silent redirects
   (`NotFound.tsx`, `ContentDetail.tsx:231-252`).
8. **Deep links survive.** Detail pages accept either section and rewrite to the canonical URL with
   `replace` (`ContentDetail.tsx:232-236`).

---

## 3. Concrete problems

Each item: **type** (UX / UI / TECH), what was read, and why it hurts.

### A. Discovery and navigation

**A1 — UX — The landing "scholars" block shows subjects.**
`components/Subjects.tsx:126` renders a section with `id="scholars"`, heading *"Every lesson has a
teacher."* (`Subjects.tsx:130`) and copy about following a scholar's body of work — but the data is
`top` = `ranked.slice(0, 5)` (`Subjects.tsx:62-70`) of **subjects**, and every tile links to
`/subjects/${s.slug}` (`Subjects.tsx:109`).
A visitor who came for a scholar lands on a subject page. This is the single clearest content-model
mistake in the public UI.

**A2 — UX — A scholar cannot be opened, only listed.**
`Scholars.tsx:27-33` — the tile footer link *"View work →"* points at `/lectures` **without any scholar
filter**. Opening a scholar therefore drops the scholar entirely and shows the unfiltered lecture
list. Combined with the missing `/scholars/:id` route (`App.tsx:71`), the entity the whole product
copy is built on ("Every lesson has a teacher", "Follow a scholar's full body of work") has no
destination.

**A3 — UX — Episode order is alphabetical, not the intended sequence.**
`lib/series.ts:41` sorts collection items with `a.title.localeCompare(b.title)`, and
`SeriesDetail.tsx:76` sorts the episode list the same way. The episode badge is positional
(`SeriesDetail.tsx:25`: `String(idx + 1).padStart(2, '0')`), so the page prints **"01, 02, 03…"** over
an alphabetically sorted list. Meanwhile the site promises sequences ("ordered into sequences you can
actually finish", `Lectures.tsx:259`). For a course this actively misleads.

**A4 — UX — "More in this series" states a wrong number.**
`ContentDetail.tsx:139-152` fetches the collection, sorts it, then stores only `.slice(0, 6)`; the
rendered count is `{siblings.length + 1}` (`ContentDetail.tsx:167`). A 30-part collection therefore
claims *"7 parts"*. This contradicts the project's own honesty rule for user-visible numbers
(`AGENTS.md` §2) and is the kind of claim a visitor can catch.

**A5 — UX — Everything is capped at 100 items, silently, and no page says so.**
`limit: 100` is hard-coded in eight places (`Lectures.tsx:217`, `Books.tsx:189`,
`SubjectDetail.tsx:93,97`, `SeriesDetail.tsx:72`, `Scholars.tsx:77`, `Subjects.tsx:78`,
`components/Subjects.tsx:35`). The counters shown to the user are the **loaded page**, not
`pagination.total`: `StatRow` on Lectures/Books/Subjects (`Lectures.tsx:261`, `Books.tsx:236`,
`Subjects.tsx:120`) and the "N lectures found" line (`Lectures.tsx:328`). Past 100 published records
the library grows in the database but the interface stops at 100 and *under-reports the count*. This
is already documented as a measured, deliberately deferred item (`docs/CONTEXT.md` §8.2/§8.16) — it
is recorded here because it is the boundary at which the current UX breaks.

**A6 — UX — No global search; search only exists inside a section.**
`SearchBar` appears on `/lectures`, `/books` and `/scholars` only (`Lectures.tsx:276`, `Books.tsx:244`,
`Scholars.tsx:133`); the header has no search (`Nav.tsx:55-82`). A visitor looking for "Tahawiyyah"
must guess whether it is a lecture, a book or a series first. There is no cross-type result view.

**A7 — UX — Subject and scholar matching happens in the browser with fallbacks.**
`SubjectDetail.tsx:76-99` tries `getPublicSubject(slug)`, then falls back to fetching all subjects and
matching by slug/id/name, then re-queries contents by slug and again by id. `Scholars.tsx:109-115`
resolves a scholar's speciality by searching a client-side subject list. These fallbacks are pragmatic,
but they make the discovery path depend on full reference lists being loaded in the browser.

**A8 — UX — Dead ends and duplicated exits on the detail page.**
`ContentDetail.tsx:362-377` offers "Back to lectures/books", "Home" and "Download"; the same
"Download" also exists inside the embed block (`ContentDetail.tsx:20-27`, `:47`, `:69`, `:90`, `:114`). The
error branch repeats the same two exits (`ContentDetail.tsx:258-270`). None of them lead to the next
item in a series — see C3.

### B. Filters, lists and mobile

**B1 — UX/UI — The sticky filter panel grows without bound and dominates small screens.**
All four list pages render one sticky panel (`Lectures.tsx:273`, `Books.tsx:241`, `Scholars.tsx:132`,
`Subjects.tsx:125`) containing a search field plus **all** scholars and **all** subjects as wrapping
chips (`Lectures.tsx:290-298`, `Books.tsx:255-263`). The reference seed contains 11 subjects and 8
scholars (`server/src/seed.ts`); on a 375 px viewport this is already a multi-row panel stuck under a
fixed header, and it grows linearly with the library. Below the panel, content is pushed off-screen.

**B2 — UI — Chip labels silently disagree with the same subject's real name.**
`Lectures.tsx:236` and `Books.tsx:208` build chip labels with `s.name.replace(/ &.*/, '')`, so
"Tafsīr & Qur'anic Sciences" becomes "Tafsīr" in the filter bar while the subject page, detail tags
and cards use the full name. Truncating by regex also risks mangling names that legitimately contain
`&`.

**B3 — UI — The same control has two names.**
The same control is presented two ways: Books puts a group heading **"Edition"** above its
format chips with options Books/Documents (`Books.tsx:262`), while Lectures renders the equivalent
Audio/Video row with no heading at all (`Lectures.tsx:298`) and calls it "format" internally
(`Lectures.tsx:171-175`). "Edition" is also simply the wrong word for a media kind, and the panel
otherwise has no group headings either.

**B4 — UX — Retry behaves differently for the same failure.**
`Books.tsx:284` and `Lectures.tsx:322` call `window.location.reload()` (full page reload, scroll reset,
all state lost); `Scholars.tsx:150` and `Subjects.tsx:140` call `fetchData()`. Same error card, same
copy, two behaviours.

**B5 — UX — The error card prints the raw client message.**
`Lectures.tsx:321` and `Books.tsx:283` render `{error}` verbatim under a friendly headline; those
strings come from the client (`Lectures.tsx:227` "Failed to load lectures", `Books.tsx:199`
"Failed to load books") or straight from the API. For a visitor this is developer copy.

**B6 — UI — Three tiny type sizes for the same kind of badge.**
`0.62rem` (`Lectures.tsx:50-51`, `Books.tsx:82`, `SeriesDetail.tsx:25`), `0.68rem`
(`SeriesDetail.tsx:30`, `Books.tsx:80`) and `0.72rem` (`Lectures.tsx:47,58`, `SubjectDetail.tsx:52`)
are all used for
provider/format/meta chips. `0.62rem` is ≈9.9 px — below comfortable mobile reading size, and the
inconsistency is visible side by side on the same card.

**B7 — UX — Back from a detail page always lands at the top of the list.**
`Layout.tsx:9-11` forces `scrollTo(0)` on every route change, which also overrides the browser's
Back behaviour. A visitor who scrolled to item 14 in a list and opened it returns to the top of that
list. (Forward navigation *should* start at the top; Back should not.)

### C. Detail pages and playback

**C1 — UX — Three different presentations of "the cover".**
`Books.tsx:15-30` renders a generated spine with the title on a subject-tinted gradient;
`SubjectDetail.tsx:45` uses a plain gradient; `ContentDetail.tsx:383-412` shows the cover inside an
`h-[420px]` spacer (`ContentDetail.tsx:406`) with `object-contain`. The detail variant reserves a large
empty surface for a small image, and the same book looks like three different objects depending on
where you meet it.

**C2 — UI — A public page prints an internal identifier.**
`SeriesDetail.tsx:157-158` renders "All N items shown — share this collection via URL" plus
`collectionIdentifier: <raw id>` in a monospace box; the 100-item cap (A5) can make the completeness
claim false.

**C3 — UX — No continuity inside a series.**
`SeriesDetail.tsx` lists episodes and `ContentDetail.tsx` shows "More in this series", but no page
offers next/previous, "play all", or position ("Episode 3 of 12" against a real sequence). Given A3,
continuity is the feature that would make the series model actually pay off.

**C4 — UX — Artwork/cover block appears even when it adds nothing.**
`ContentDetail.tsx:383-412` renders the block when `coverMedia.src` exists **or** the item is audio
without a source; for audio without artwork it renders a large framed `AudioPlaceholder`. On a lecture
page that is a full-width dead panel between "About" and the footer.

### D. Visual system and technical UI debt

**D1 — UI — One non-brand colour is used site-wide.**
`PageHeader.tsx:24`, `Hero.tsx:121` and `Closing.tsx:68` all pass `['#A2AB73', '#CC3A63', '#5227FF']`
to `Aurora`. `#5227FF` (violet) is not in the official palette
(`brand/BRAND_IMPLEMENTATION.md`, `index.css:126-152`), so the aurora is the only place an off-brand
hue appears — on every page, via `PageHeader`. Two hover colours are also hard-coded instead of using
tokens: `bg-[#b83156]` (`Hero.tsx:147`, `Closing.tsx:86`) and `text-[#22251a]`
(`Subjects.tsx:20`, also `pages/Subjects.tsx:10`).

**D2 — TECH/UI — Official brand tokens have no consumer (yet).**
`index.css:141-148` defines `--color-brand-bg`, `--color-surface`, `--color-charcoal` with a comment
stating the UI deliberately keeps cream/sand/ink. Nothing reads them. That is honest documentation
debt rather than a bug, but a future reader will wonder whether they are wired up.

**D3 — TECH — Aurora runs an always-on, uncapped WebGL loop per page.**
`Aurora.tsx:130-160`: `new Renderer({ alpha: true, antialias: true })`, `renderer.setSize(w, h)`
with no `setPixelRatio` cap, RAF started at mount (`Aurora.tsx:195`), no `IntersectionObserver` and no
`visibilitychange` pause, and no reduced-motion branch for the canvas itself (the CSS rule in
`index.css:175-183` cannot stop WebGL). One instance per subpage via `PageHeader.tsx:24`, two on the
landing page (`Hero.tsx:121`, `Closing.tsx:68`). On a 3× mobile display the fragment shader runs at
device resolution behind decorative content, forever.

**D4 — TECH — Stale default props in Aurora.**
`Aurora.tsx:120` defaults to `['#5227FF', '#7cff67', '#5227FF']` — a template palette. All three call
sites pass their own stops, so nothing is visibly wrong today, but the next caller gets non-brand
colours for free.

**D5 — TECH — AudioPlayer keeps a RAF loop on a page that also embeds a third party.**
`AudioPlayer.tsx:111-158` starts/stops the waveform loop on events; there is no `document.hidden`
guard. The player and an Archive/YouTube iframe can be mounted on the same page
(`ContentDetail.tsx:26-32` and `:96-110`).

**D6 — TECH — `Books.tsx` and `Lectures.tsx` are near-copies.**
338 and 375 lines that are the same page twice: identical skeleton, error card, filter panel,
340 ms debounce, `updateParam`, `clearAll` and chips wiring. After normalising the words
"book/lecture", **204 lines still differ** — i.e. the duplication is real and large, and it is exactly
where B3/B4/B5 drift came from. `Subjects.tsx`/`Scholars.tsx` repeat the same pattern.

**D7 — TECH — 52 `as any` casts in the public UI.**
`Tag tone={subj.accent as any}` (`Lectures.tsx:56,107`; `Books.tsx:49,89`; `ContentDetail.tsx:294`;
`SeriesDetail.tsx:20,135`), `(res as any).data` (`Lectures.tsx:193-194`, `Books.tsx:166-167`,
`SubjectDetail.tsx:81`), `active={urlScholar as any}` (`Lectures.tsx:290-298`). The API types exist in
`lib/api.ts`; the casts hide the true shapes and are where silent-empty-list bugs would hide.

**D8 — TECH — Two result counters announce themselves, four do not.**
`role="status" aria-live="polite"` on `Lectures.tsx:325` and `Books.tsx:289`; the equivalent lines in
`Subjects.tsx:145`, `Scholars.tsx:155`, `SubjectDetail.tsx` and `SeriesDetail.tsx` are plain `<p>`.
Filtering the latter pages moves no focus and announces nothing.

**D9 — TECH/UI — Filter chips and the mobile menu have no pressed/expanded semantics.**
`ui.tsx:51-80` renders colour-only `<button>` state with a `<p>` label that is not programmatically
associated (`Lectures.tsx:280`); there is **no** `aria-pressed` anywhere in the codebase, and the
hamburger toggle (`Nav.tsx:69-78`, panel from `:82`) has no `aria-expanded`/`aria-controls`. Screen-reader users hear
"Tafsīr, button" with no idea whether it is on.

**D10 — UX — Extra round trips in two places.**
`ContentDetail.tsx:140` falls back to fetching the entire library (`limit: 100`) when a collection
query returns nothing, and `SubjectDetail.tsx:97` re-queries by id after the slug misses. Read-only
observation; no benchmark was run in this audit.

**D11 — TECH — Inconsistent retry and loading boundaries between list and detail pages.**
List pages show six skeleton cards plus a status line (`Lectures.tsx:313-317`); detail pages replace the
whole header with `title="Loading…"` (`ContentDetail.tsx:240`, `SubjectDetail.tsx:120`,
`SeriesDetail.tsx:92`), and `SeriesDetail.tsx:57-68` can title the tab with a slug-derived string while
loading.

---

## 4. UX vs UI vs TECH — clean separation

| # | Finding | UX | UI | TECH |
| --- | --- | --- | --- | --- |
| A1 | Landing "scholars" section shows subjects | ● | | |
| A2 | No scholar destination; "View work" loses the scholar | ● | | |
| A3 | Series/episode order alphabetical, badges imply sequence | ● | | ● |
| A4 | "More in this series" prints a wrong part count | ● | | |
| A5 | Silent 100-item cap, counters under-report | ● | | ● |
| A6 | No global search | ● | | |
| A7 | Reference matching done client-side with fallbacks | ● | | ● |
| A8 | Dead ends / duplicated exits on detail pages | ● | | |
| B1 | Unbounded sticky filter panel on mobile | ● | ● | |
| B2 | Regex-truncated chip labels | | ● | |
| B3 | "Edition" vs "Format" for one control | | ● | |
| B4 | Retry: reload vs refetch | ● | | ● |
| B5 | Raw client error strings shown to visitors | ● | | |
| B6 | Three tiny badge sizes | | ● | |
| B7 | Back-navigation loses list position | ● | | |
| C1 | Three cover presentations; 420 px empty frame | | ● | |
| C2 | Internal identifier printed on a public page | | ● | |
| C3 | No next/previous or play-all in a series | ● | | |
| C4 | Cover/artwork panel appears when it adds nothing | ● | ● | |
| D1 | Off-palette violet + hard-coded hover colours | | ● | |
| D2 | Brand tokens unused | | ● | ● |
| D3 | Always-on uncapped WebGL loop | | | ● |
| D4 | Stale Aurora defaults | | | ● |
| D5 | RAF loop without visibility guard | | | ● |
| D6 | Books/Lectures are near-copies (204 differing lines) | | | ● |
| D7 | 52 `as any` casts | | | ● |
| D8 | Only 2 of 6 result counters announce | ● | | ● |
| D9 | No `aria-pressed`/`aria-expanded` | ● | | ● |
| D10 | Extra full-library round trips | | | ● |
| D11 | Inconsistent loading/retry boundaries | ● | | ● |

---

## 5. Most important UX opportunities

Ordered by (visitor value ÷ risk). Each is a *proposal*, not a decision: nothing has been implemented.

1. **Make the scholar a real destination (A1 + A2).** A scholar hub page collecting everything by that
   teacher, plus fixing the landing block so a scholar card is a scholar. This is the largest single
   gain: it is the story the product already tells, and today it is the only one with no page.
2. **Make a series behave like a series (A3 + C3).** Real order (whatever the data actually carries:
   episode number, position, publication order) and continuity — "Episode 3 of 12", next/previous,
   and a way to keep playing. Spotify's album/playlist page is the reference here: one obvious
   "play", a numbered ordered list, and no dead ends.
3. **One search box for the whole library (A6).** A single field that returns mixed results grouped by
   type — that is what makes a library feel navigable rather than a set of separate shelves. Spotify
   solves this with one search surface and result categories; ilmNet has the data to do the same
   without touching the design language.
4. **Tell the truth about scale and make the lists extendable (A5 + A4).** Counters from
   `pagination.total`, plus "load more"/paging when a real library passes 100 items. Small change,
   removes the first point at which the UI would lie.
5. **Tame the filter panel on small screens (B1 + B2 + B3).** Collapsible filter groups, chips built
   from real names, one shared vocabulary for the same control.
6. **Cheap honesty and consistency pass (A8 + B4 + B5 + D8 + D9).** One retry pattern, no raw error
   strings, `aria-pressed`/`aria-expanded`, result announcements on all six list surfaces.
7. **Performance hygiene (D3 + D5).** Pause the aurora when it is offscreen or the tab is hidden, cap
   the device pixel ratio, and honour reduced motion inside the canvas. Decorative only, so the
   visual result is unchanged where it matters.

---

## 6. Proposed improvements per page

**Landing (`/`)**
- Split the current subjects block into a *scholar* block (real scholars, linking to scholar hubs) and
  keep the subject pills as subjects (A1).
- Give the hero's "How ilmNet works" anchor a shorter distance to its target, or move the section up
  (`#how` currently sits three sections below the hero: `Hero.tsx:152` → `Closing.tsx:24`, with
  `Library` and `Subjects` in between, `Landing.tsx:17-24`).
- Reduce to **one** aurora surface on the landing page (D3).

**Lectures (`/lectures`) and Books (`/books`)**
- Extract the shared list machinery into one component/hook, then re-add the genuine differences
  (aspect ratio, cover vs thumbnail, "Edition"/"Format" → one word) (B3, D6).
- Collapse the filter panel behind a "Filters" summary on small screens; keep search always visible
  (B1).
- Show `pagination.total` in the `StatRow` and add a "load more" boundary (A5).
- Use full subject names in chips (B2), one badge size scale (B6), one retry handler (B4), and a
  visitor-readable error line (B5).

**Series / collections (`/series/:id`)**
- Sort by real sequence, keep the number badge tied to that order, and state the sequence basis (A3).
- Add position, next/previous and a "start from the beginning" affordance (C3).
- Remove the raw identifier line and make the completeness claim conditional on actually showing
  everything (C2).

**Content detail (`/lectures/:id`, `/books/:id`)**
- One cover/artwork presentation shared with the cards; drop the 420 px empty frame (C1) and skip the
  panel entirely when there is nothing to show (C4).
- Correct the "parts" count, or omit it (A4).
- Consolidate the three exits into: back to the list, back to the series (when there is one), and one
  download action (A8).
- Add series continuity here too, since this is where a visitor arrives from a search engine (C3).

**Scholars (`/scholars`)**
- Turn each tile into a real destination (A2); if a hub page is not wanted, at minimum link to
  `/lectures?scholar=<slug>` so the filter is actually applied.
- Announce the filtered count (D8).

**Subjects (`/subjects`) and subject detail (`/subjects/:id`)**
- Announce the filtered count (D8); keep the good separation between "no subjects yet" and "nothing in
  this group".
- Consider a single request pattern instead of the slug→id fallback chain (A7).

**Navigation / footer / mobile**
- Header: add the search entry point (A6) and give the hamburger `aria-expanded` (D9); keep the
  contextual CTA but stop duplicating "Home" inside the mobile panel when the page *is* home
  (`Nav.tsx:88-101`).
- Keep Back-navigation position (B7): scroll to top on push, but not on pop.
- Footer already only links to real destinations (`SiteFooter.tsx:13-30`) — leave that contract alone.

---

## 7. Recommended implementation order

| Step | Scope | Why first | Risk |
| --- | --- | --- | --- |
| 1 | Honesty + a11y pass: A4, B4, B5, D8, D9 | Small, purely corrective, removes user-visible false statements | Low |
| 2 | Series ordering + continuity: A3, C3, C2 | Fixes actively misleading content; no data model change needed if the order field exists | Medium |
| 3 | Scholar destination: A1, A2 | Biggest UX gain; needs a route + a query pattern, no new entity | Medium |
| 4 | Global search: A6 | Main discovery upgrade; reuses the existing API search | Medium |
| 5 | Scale boundaries: A5, plus counters from `pagination.total` | Prevents the library outgrowing its own UI | Medium |
| 6 | List/filter refactor: D6, B1, B2, B3, B6 | Removes the duplication that produced the drift | Medium/High (touch every list) |
| 7 | Visual consistency: D1, D2, C1, C4 | Touches the look; do it after the behaviour is right, one deliberate decision at a time | Medium |
| 8 | Performance hygiene: D3, D4, D5, D10, D11, A7 | Real but invisible to visitors until measured | Low |

Steps 1–2 can ship independently and are the ones a visitor would notice most per hour of work.

---

## 8. What must **not** be changed

- **The design language.** Cream/sand surfaces, olive/rose accents, the neumorphic `neu-*` shadows,
  Plus Jakarta Sans + Inter, the rounded-card geometry. This audit does not propose a restyle, and
  Spotify is a reference for *discovery patterns*, never for visuals.
- **The brand.** Logo SVGs (`public/brand/logo/*.svg`), the favicon/app-icon set, `#F3EBDD`/`#CC3A63`
  and the other official tokens stay exactly as delivered in Fase 6.0/6.1.
- **Honesty rules.** No invented counts, no placeholder content, no "0 that looks like an empty
  library", no mock fallbacks for failed providers, and empty states must keep distinguishing
  filter-exhaustion from an empty library.
- **Public API shape and payload projections.** Lists stay `publicContentList`-shaped; do not re-add
  heavy fields to a list for UI convenience (`AGENTS.md` §2, Fase 5.4 measurements).
- **`collection=<identifier>` for series filtering** — never `q=` (`AGENTS.md` §2).
- **Auth, sessions, backend, database and admin behaviour.** Out of scope; the audit touched none of it.
- **No CMS framework / content layer for site copy** (TinyCMS stays scrapped), and no new dependency
  without explicit permission.
- **No religious decorative symbols**, no stock imagery, no fake artwork — if a cover is missing, the
  existing honest placeholder stays.
- **Existing e2e contracts** (footer links that resolve, search-field accessible names, brand assets,
  shareable filter URLs) must keep passing; the production suite pins them
  (`tests/e2e/production.spec.mjs`).

---

## 9. Method and limits of this audit

- Sources: the files listed in §1, read in full at `5d7c26f`; `docs/CONTEXT.md`, `AGENTS.md`,
  `brand/BRAND_IMPLEMENTATION.md`, `brand/SVG_RECONSTRUCTION.md`; `server/src/seed.ts` for reference
  data size; `tests/e2e/production.spec.mjs` for pinned behaviour.
- Read-only static checks performed: route/component inventory, per-file line counts, greps for
  `limit: 100`, `pagination`, `localeCompare`, `aria-*`, `as any`, `window.location.reload`,
  `colorStops`, hard-coded hex values, `target="_blank"`/`rel`, `<iframe>`, `sticky`, and a
  normalised diff between `Books.tsx` and `Lectures.tsx`.
- **Not done:** no build, no type-check, no browser run, no Lighthouse/profile measurement and no
  database query — none of those artifacts exist in this workspace and installing dependencies was
  out of scope for a read-only audit. Performance statements (D3, D5, D10) are therefore *structural
  observations from the code*, not measured numbers; they must be measured before/after any change.
- **No content claims:** where a number appears in this document it comes from the repository (for
  example: 11 subjects and 8 scholars in `server/src/seed.ts`, 52 `as any` occurrences, 204 differing
  lines between the two list pages).
