# Fase 3.9 — Final production codebase review

Vanaf commit `944a83f`, gevolgd door **Fase 3.9.1** (vanaf `cfe8587`) die de eerlijkheidsproblemen
uit de onafhankelijke sanity check van 3.9 heeft opgelost. Doel: vaststellen wat er nog nodig is
vóór publieke lancering, en **alleen noodzakelijke fixes** doorvoeren (geen nieuwe features, geen
redesign, geen TinaCMS).

> **Lees dit document samen met de sectie [Fase 3.9.1](#fase-391--eerlijkheid-van-cijfers-status-en-copy)
> onderaan.** De tabel hieronder beschrijft de bevindingen en fixes van 3.9; de sanity check vond
> daarna nog een reeks verklaarde cijfers en admin-statussen die in 3.9.1 zijn gecorrigeerd.

## Werkwijze

Volledige doorloop van de 63 codebestanden (14.337 regels) langs veertien assen: publieke frontend en
routes · Lectures/Books/Scholars/Subjects · series & content-relaties · embeds/audio/downloads ·
zoeken & filters · admin CMS · API/frontend-koppeling · loading/empty/error states · mobile ·
security · database-integriteit · resterende demo/mock/fallback-code · performance · documentatie.

## Gevonden problemen

| # | Bevinding | Ernst | Actie |
| --- | --- | --- | --- |
| 1 | **Landingspagina toonde verzonnen statistieken** — `src/components/Subjects.tsx` had vaste "disciplines" met "18 series · 122 hrs", "24 series · 160 hrs" enz. Die cijfers bestaan nergens in de database. | hoog (publiek, misleidend) | gefixt in 3.9 (Subjects-sectie); de Hero-cijfers `1,240+ / 380 / 96` zijn in **3.9.1** vervangen door echte API-counts |
| 2 | De subject-pills op de landing waren 12 statische labels (`cursor-default`, niet klikbaar) die deels niet overeenkwamen met de echte subjects. | middel | gefixt |
| 3 | **Publieke copy beloofde niet-bestaande functionaliteit** — "Keep your place · your progress stays with you" (Closing) en "saved progress and chapter navigation" (Library). De app heeft geen accounts en geen voortgangsopslag; het enige dat bewaard wordt is het admin-token in `sessionStorage`. | hoog (publiek, misleidend) | gefixt |
| 4 | Hero-kaart heette "Now playing" terwijl er niets speelt (decoratieve illustratie). | laag | gefixt in 3.9 → "Player preview"; in **3.9.1** zijn ook de verzonnen episode-/voortgangsgegevens van die kaarten verwijderd |
| 5 | **Admin toonde spookcontent**: bij een mislukte of offline API werden records optimistisch in de lokale lijst gezet ("saved locally") en statuswijzigingen/verwijderingen faalden stil (`.catch(() => {})`). De beheerder kon denken dat content live stond terwijl er niets in de database stond. | hoog (beheer) | lijst + revert gefixt in 3.9; de **activiteitenfeed** logde mislukte acties nog steeds → gefixt in **3.9.1** |
| 6 | Admin-activiteitenfeed startte met `seedActivity`: zeven verzonnen "Updated/Added/Published …" regels. | middel | gefixt → leeg + lege-staat |
| 7 | De zijbalk meldde altijd "Connected to the PostgreSQL library", ook zonder backend. | laag | gefixt in 3.9 (dynamisch); in **3.9.1** uitgesplitst naar "token ontbreekt/geweigerd (401)" versus "backend onbereikbaar" |
| 8 | **Demo/mock-code**: `mockFetchArchiveCollection` + `MOCK_TITLES/CREATORS/THUMBS` (frontend-only nep-collecties), de demo-tak in `ArchiveImportPage` (`isMockDemoUrl`, "Demo mock: ilmnet-collection"-knop), ongebruikte demo-arrays (`seedLectures`, `seedBooks`, `seedScholars`, `seedSubjects`) en de placeholderdatasets in `src/data.ts` (subjects/scholars/lectures/books + `subjectById`/`scholarById`). | middel (dode/vervuilende code) | gefixt |
| 9 | Admin-formulieren hadden "Try example"-knoppen die dode URL's invulden: `archive.org/details/ilmnet-removal-of-doubts` (bestaat niet), `books.google.com/books?id=quduri_mukhtasar_example`, `example.com/books/al-adhkar.pdf`. | middel (kan kapotte records opleveren) | gefixt |
| 10 | 2 interne links met `target="_blank"` zonder `rel="noopener noreferrer"` (ContentWizard → scholars/subjects). | laag | gefixt |
| 11 | Geen README in de repository terwijl de site publiek gelanceerd wordt. | laag | gefixt (beknopte README) |

## Bewust níet veranderd

| Bevinding | Waarom niet |
| --- | --- |
| **Code-splitting / lazy-loading van de admin** (de publieke bundel bevat de hele CMS) | Gemeten: `vite-plugin-singlefile` inlinet alles in één `index.html`, dus lazy routes leveren géén winst (637 kB → 643 kB). Splitsen kan pas als het single-file builddoel vervalt — dat is een architectuurkeuze, geen reviewfix. |
| Bundlegrootte ~629 kB (157 kB gzip) | Voor een single-file SPA met React + router acceptabel; de opruiming hierboven scheelde al ~7 kB. |
| Geen rate limiting op publieke endpoints | Publieke reads zijn read-only en de admin/import-endpoints vereisen het token; toevoegen is een infrastructuurkeuze (reverse proxy), geen codefix. |
| Publieke lijsten halen maximaal 100 items per type op | Bij de huidige omvang (19 items) ruim voldoende; bij groei is server-side paginering (`pagination.total` bestaat al) de logische vervolgstap. |
| Zoeken met `contains`/`insensitive` over meerdere kolommen | Correct en snel genoeg bij deze schaal; een trigram/full-text index is pas nodig bij duizenden records. |
| Historische fase-documenten (FASE2A/FASE3_*) | Blijven staan als verslag; waar ze nu onjuist zijn, is een korte "Fase 3.9"-noot toegevoegd in plaats van herschrijven. |
| `example.com`-URL's in de demo-seed (`server/src/seed.ts`, o.a. r.391/426) | Horen bij de **destructieve demo-seed** die in productie weigert te draaien (Fase 3.8.1) en alleen dient om een dev-database te vullen. De productie-veilige `seed:reference` raakt geen content. |
| Geen retry-knop op SeriesDetail/SubjectDetail/ContentDetail | Loading-, error- en lege staten zijn aanwezig met een duidelijke melding en terug-link; de pagina herladen doet hetzelfde. Een retry-knop zou per pagina nieuwe state introduceren — buiten de minimale-fix-scope van deze review. |

## Doorgevoerde wijzigingen

- `src/components/Subjects.tsx` — volledig op echte data: de pills zijn nu links naar
  `/subjects/<slug>` voor de werkelijke gepubliceerde subjects (met het echte aantal items als
  tooltip), en de vijf cirkels tonen de top-5 subjects met hun echte item-aantal ("No items yet" /
  "1 item" / "N items"). Bij een onbereikbare API blijven alleen de kop en de CTA over — er wordt
  nooit een getal verzonnen.
- `src/components/Closing.tsx`, `src/components/Library.tsx` — beloftes vervangen door wat de app
  werkelijk doet (stabiele links per item; embed + directe link naar de bron).
- `src/components/Hero.tsx` — "Now playing" → "Player preview".
- `src/admin/store.tsx` — activiteitenfeed start leeg; **geen spookrecords meer**: bij een offline
  backend of een mislukte schrijfactie wordt de optimistische wijziging teruggedraaid en verschijnt
  "… failed — the backend is unreachable. Nothing was written to the database."
- `src/admin/Overview.tsx` — lege-staat voor de activiteitenfeed.
- `src/admin/AdminLayout.tsx` — verbindingsstatus toont "Backend unreachable …" zodra de API weg is.
- `src/admin/data.ts` (765 → 539 regels) — demo-arrays en de mock-generator verwijderd.
- `src/admin/ArchiveImportPage.tsx` — demo-mock-tak, demo-knop en "desiredCount" weg; een mislukte
  fetch is nu altijd een foutmelding en een preview zonder backend-job importeert niets
  ("Nothing to import — re-analyse the URL…").
- `src/admin/BookForm.tsx`, `src/admin/ContentWizard.tsx` — dode voorbeeld-URL's en de
  "Try example"-rijen verwijderd; interne `target="_blank"`-links kregen `rel="noopener noreferrer"`.
- `src/data.ts` (120 → 18 regels) — alleen nog `subjectGroups`, `formatCount`, `formatDuration`.
- `README.md` — nieuw: wat ilmNet is, stack, quick start, env, tests, deployment-verwijzing.
- Docs: `FRONTEND_ADAPTER.md` en `FASE3_ADMIN_CMS.md` voorzien van een 3.9-statusnoot.

## Verificatie na de wijzigingen

| Controle | Resultaat |
| --- | --- |
| `npx tsc --noEmit` (root én server) | 0 fouten |
| `npm run build` (root) | 629.30 kB · gzip 157.34 kB |
| `npm run test:all` (server) | audit ✅ · uploads 25/25 · production 44/44 · env-hardening 13/13 · youtube ✅ |
| `npm run test:imports` (tegen de live server) | 19/19 |
| `npm run test:e2e:production` | 61/61 |
| `npm run test:e2e` (media/waveform/thumbnails) | 27/27 |
| Browsercontrole landingspagina | 11 echte subject-links, kaarten met echte aantallen, geen "18 series · 122 hrs" / "saved progress" / "Keep your place" meer in de DOM |
| Database-integriteit (prod) | 0 wezen, 0 dubbele slugs, 0 published zonder `publishedAt`, 19 contents / 11 subjects / 8 scholars intact |

## Fase 3.9.1 — eerlijkheid van cijfers, status en copy

De onafhankelijke sanity check op `cfe8587` vond 11 punten. Alles hieronder is gecorrigeerd; er zijn
geen features bijgekomen, geen redesign en geen mockdata.

### Opgeloste punten

| # | Bestand | Bevinding | Fix |
| --- | --- | --- | --- |
| 1 | `src/components/Hero.tsx` | Vaste, verzonnen kerncijfers (`1,240+` lectures, `380` boeken, `96` scholars) in het eerste scherm. | De rij wordt nu gevuld met **server-side totalen** (`listPublishedContents({ limit: 1, type: … }).pagination.total` voor lectures en books, `listPublicScholars().data.length` voor scholars), dus ook correct boven de 100 items. Zolang de API niet heeft geantwoord is de rij **afwezig**; er komt nooit een placeholder-cijfer. |
| 2 | `src/components/Hero.tsx` | De decoratieve kaart beloofde voortgang: "Continue where you left off", "Chapter 3 · 62 pages left", tijdlijn `18:24 / 43:50`, voortgangsbalk en een `play`-knop die niets doet. | Voortgangsbalk, tijden en de knop zijn weg; de kaart zegt nu wat waar is ("Lecture audio", "Book preview", "Scans stay on Archive.org"). De onderste kaart noemt de echte groepeermethode: **Scholar · Subject · Series**. |
| 3 | `src/pages/Lectures.tsx` | `totalListens = contents.length * 120` → publiek "1.3k LISTENS". | Metric verwijderd; de derde StatRow-waarde is nu de niet-cijferige, ware eigenschap `Free · To listen`. |
| 4 | `src/pages/Lectures.tsx`, `src/pages/Books.tsx` | StatRow "Items" telde kaarten (series als 1), niet items: /books toonde "1 ITEMS" boven "8 books found". | "Items" = `contents.length` (echte aantal items), "Series" = `series.length`, "Collections" = `series.length`. De regel eronder blijft dezelfde telling tonen. |
| 5 | `src/pages/{Lectures,Books,Subjects,Scholars}.tsx` | Bij een API-fout stond er "0 ITEMS · 0 SERIES" naast de foutmelding — alsof de bibliotheek leeg was. | Alle vier StatRows tonen `—` zolang `loading` of `error` geldt. |
| 6 | `src/admin/store.tsx` | De activiteitenfeed logde de actie **vóór** de API-call: een mislukte statuswijziging verscheen als "Unpublished · lecture" terwijl de database onveranderd bleef. | `push(log(...))` gebeurt nu pas ná de bevestiging door de backend (create/patch/delete/publish). Een mislukte actie levert uitsluitend een foutmelding op. |
| 7 | `src/admin/Overview.tsx`, `src/admin/ContentWizard.tsx` | Copy zei dat er niets werd opgeslagen: "Library desk — frontend only", "Nothing is written to a server yet.", "nothing is permanent yet — this is still frontend only." | Vervangen door wat de code doet: alles wordt in de PostgreSQL-bibliotheek opgeslagen en verschijnt na publicatie op de publieke site. De wizard zegt nu "nothing is saved until the final step". |
| 8 | `src/admin/store.tsx`, `src/admin/AdminLayout.tsx` | Een ontbrekend of geweigerd token werd gemeld als "Backend unreachable". | De store houdt `backendState` bij (`connecting` / `online` / `unauthenticated` / `offline`). 401/403 → "Admin token missing or rejected (401) — set a valid token…"; alleen een echte netwerkstoring zegt nog "Backend unreachable". Ook schrijfpogingen melden nu het tokenprobleem. |
| 9 | `src/admin/Overview.tsx` | Verouderd, naar reviewers gericht blok ("Tip for reviewers …") in het productie-beheer. | Verwijderd. |
| 10 | `src/admin/ArchiveImportPage.tsx`, `src/admin/YouTubeImportPage.tsx` | Demo-/testsnelknoppen die een niet-bibliotheekvideo (o.a. `dQw4w9WgXcQ`) of willekeurige collecties in het formulier zetten. | Beide rijen verwijderd; de veldhints beschrijven de ondersteunde URL-vormen. |
| 11 | `src/admin/ContentWizard.tsx`, `src/pages/ContentDetail.tsx` | Hint met `publisher.example`-voorbeelddomein; stille `.catch(() => {})` bij het laden van de serie-zijbalk. | Hint beschrijft nu het echte gedrag ("direct link ending in .pdf"); de catch handelt de fout expliciet af en toont geen verouderde items. |

### Verificatie na 3.9.1

| Controle | Resultaat |
| --- | --- |
| `npx tsc --noEmit` (root én server) | 0 fouten |
| `npm run build` (root) | ±628 kB · gzip ±157 kB (iets kleiner dan 3.9 doordat de verzonnen metrics en demo-UI zijn verwijderd) |
| `npm run test:all` (server) | audit ✅ · uploads 25/25 · production 44/44 · env-hardening 13/13 · youtube ✅ |
| `npm run test:imports` (live) | 19/19 |
| `npm run test:e2e:production` | 61/61 |
| `npm run test:e2e` (media/waveform/thumbnails) | 27/27 |
| Eigen browsercontrole publiek | 22/22 (hero exact gelijk aan de server-side totalen): geen `1,240+`/`380`/`96`, geen "18:24"/"62 pages left"/"Continue where you left off", hero toont de echte counts (12 lectures · 8 books · 8 scholars), StatRow `—` bij API-fout, geen niet-functionele play-knop |
| Eigen browsercontrole admin | 14/14: geen niet-persistentie-copy, geen spookregel in de activiteitenfeed na een geblokkeerde write, geslaagde actie verschijnt wél, database onveranderd bij falen |
| Statusmelding per tokensituatie | geen token → 401-melding · fout token → 401-melding · juist token → "Connected" · API gestopt → "Backend unreachable" |

### Bewust ongewijzigd in 3.9.1

- De Nederlandse teksten in `src/admin/AdminTokenPanel.tsx` — ze zijn feitelijk juist (token in
  `sessionStorage`, alleen voor `/api/admin`) en dus niet misleidend.
- Decoratieve illustraties die geen data claimen (waveform-balken, boekspines, aurora).

## Restrisico's voor de volgende fase

1. **Single-file bundel** — de admin-CMS zit in dezelfde `index.html` als de publieke site en er kan
   niets gecode-splitst worden zolang `vite-plugin-singlefile` actief is.
2. **Publieke lijsten op 100 items** — bij groei van de bibliotheek moet de frontend naar
   server-side paginering/infinite scroll.
3. **Zoeken** is `ILIKE %q%` over meerdere kolommen; bij duizenden records is een index/trgm nodig.
4. **Geen rate limiting** op de publieke API (reverse-proxy taak).
5. **Import-endpoints** doen externe calls (Archive.org/YouTube) met vaste limieten; bij misbruik
   vanuit een gecompromitteerd admin-token is er geen throttling.
6. De audio- en boekbestanden blijven afhankelijk van archive.org-beschikbaarheid; de player en de downloads
   verwijzen rechtstreeks naar de bron.
