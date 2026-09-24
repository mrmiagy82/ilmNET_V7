# Fase 3.9 — Final production codebase review

Vanaf commit `944a83f`. Doel: vaststellen wat er nog nodig is vóór publieke lancering, en
**alleen noodzakelijke fixes** doorvoeren (geen nieuwe features, geen redesign, geen TinaCMS).

## Werkwijze

Volledige doorloop van de 63 codebestanden (14.337 regels) langs veertien assen: publieke frontend en
routes · Lectures/Books/Scholars/Subjects · series & content-relaties · embeds/audio/downloads ·
zoeken & filters · admin CMS · API/frontend-koppeling · loading/empty/error states · mobile ·
security · database-integriteit · resterende demo/mock/fallback-code · performance · documentatie.

## Gevonden problemen

| # | Bevinding | Ernst | Actie |
| --- | --- | --- | --- |
| 1 | **Landingspagina toonde verzonnen statistieken** — `src/components/Subjects.tsx` had vaste "disciplines" met "18 series · 122 hrs", "24 series · 160 hrs" enz. Die cijfers bestaan nergens in de database. | hoog (publiek, misleidend) | gefixt |
| 2 | De subject-pills op de landing waren 12 statische labels (`cursor-default`, niet klikbaar) die deels niet overeenkwamen met de echte subjects. | middel | gefixt |
| 3 | **Publieke copy beloofde niet-bestaande functionaliteit** — "Keep your place · your progress stays with you" (Closing) en "saved progress and chapter navigation" (Library). De app heeft geen accounts en geen voortgangsopslag; het enige dat bewaard wordt is het admin-token in `sessionStorage`. | hoog (publiek, misleidend) | gefixt |
| 4 | Hero-kaart heette "Now playing" terwijl er niets speelt (decoratieve illustratie). | laag | gefixt → "Player preview" |
| 5 | **Admin toonde spookcontent**: bij een mislukte of offline API werden records optimistisch in de lokale lijst gezet ("saved locally") en statuswijzigingen/verwijderingen faalden stil (`.catch(() => {})`). De beheerder kon denken dat content live stond terwijl er niets in de database stond. | hoog (beheer) | gefixt |
| 6 | Admin-activiteitenfeed startte met `seedActivity`: zeven verzonnen "Updated/Added/Published …" regels. | middel | gefixt → leeg + lege-staat |
| 7 | De zijbalk meldde altijd "Connected to the PostgreSQL library", ook zonder backend. | laag | gefixt → dynamisch |
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

## Restrisico's voor de volgende fase

1. **Single-file bundel** — de admin-CMS zit in dezelfde `index.html` als de publieke site en er kan
   niets gecode-splitst worden zolang `vite-plugin-singlefile` actief is.
2. **Publieke lijsten op 100 items** — bij groei van de bibliotheek moet de frontend naar
   server-side paginering/infinite scroll.
3. **Zoeken** is `ILIKE %q%` over meerdere kolommen; bij duizenden records is een index/trgm nodig.
4. **Geen rate limiting** op de publieke API (reverse-proxy taak).
5. **Import-endpoints** doen externe calls (Archive.org/YouTube) met vaste limieten; bij misbruik
   vanuit een gecompromitteerd admin-token is er geen throttling.
6. De audiotrack-voorbeelden in de demo-bibliotheek blijven afhankelijk van archive.org-beschikbaarheid.
