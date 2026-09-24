# Frontend Adapter — src/lib/api.ts & src/admin/store.tsx

## Doel
Backend levert `BackendContent` (Prisma + Fastify) met velden `type`, `provider`, `durationMin`, `pages`, `metadata`, `scholars[]`, `subjects[]`.  
Frontend admin werkt historisch met `AdminLecture` / `AdminBook` (aparte modellen uit Fase 0) terwijl backend sinds Fase 1 generiek `Content` gebruikt (lecture/audio/video/book/document). Adapter moet die kloof overbruggen zonder nieuwe UI te bouwen (audit constraint).

## Huidige mappings

### BackendContent → AdminLecture / AdminBook

`src/lib/api.ts`

```ts
export function backendToAdminLecture(c: BackendContent): AdminLecture {
  // provider youtube → youtubeUrl, archive → sourceUrl
  // type audio → format Audio, video → Video, else lecture
  // durationMin: c.durationMin ?? null  (GEEN 30 fallback)
  // episodes: 1 fallback (veilig, niet verzonnen)
}
export function backendToAdminBook(c: BackendContent): AdminBook {
  // provider mapping archive→archive, google_books→google-books etc.
  // pages: c.pages ?? null  (GEEN 120 fallback)
  // year: c.year ?? now (wel fallback maar jaar is niet kritiek)
}
```

- `durationMin` en `pages` zijn **nu `null` wanneer niet gedetecteerd**; vorige `??30` / `??120` verwijderd (audit 2). Cast `as any` houdt TS tevreden tot `AdminLecture/AdminBook` types zelf `number | null` worden.
- `mediaTypes` komt uit `metadata.archive.available_media` (Archive) of leeg.
- `scholarIds` / `subjectIds` direct uit relations.
- `language` fallback English alleen voor UI display; DB kan null zijn.

### AdminLecture/AdminBook → Backend payload

`adminLectureToPayload` / `adminBookToPayload`

- Lecture: `type` wordt afgeleid uit `format` (Audio→audio, Video→video, else lecture) indien `provider==='archive'`; youtube altijd `lecture`.
- Book: `type` uit `sourceType` (archive/google_books→book, pdf/external→document).
- `durationMin` / `pages` worden `|| null` (geen 30/120).
- `metadata` bevat nu alleen `tags` / `publisher` / `isbn`, niet grote raw dump.

### store.tsx — splitsing lecture vs book

```ts
const lecTypes = new Set(['lecture','audio','video'])
const bookTypes = new Set(['book','document'])
for (const c of contRes.data) {
  if (lecTypes.has(c.type)) l.push(backendToAdminLecture(c))
  else if (bookTypes.has(c.type)) b.push(backendToAdminBook(c))
}
```

- **Generieke types audio/video/document gaan nu niet meer via Lecture/Book-assumpties**: `audio`/`video` worden lectures, `document` wordt book — maar de mappers behandelen ze generiek (provider, embed, thumbnail logic per `contentType`, niet per oud `format`/`pages`).
- Historisch veld `format` / `level` / `episodes` voor lectures en `pages`/`publisher` voor books blijft, maar DB velden `durationMin`/`pages` zijn onafhankelijk; een `audio` record heeft `pages=null`, een `book` heeft `durationMin=null`, geen kruisvervuiling.

## Beperkingen van huidige AdminLecture/AdminBook

1. **Verplichte `durationMin: number`** — type zou `number | null` moeten zijn. Nu `as any` met `null` toegestaan, maar formulier verwacht number (toont leeg bij null). Toekomst: `durationMin?: number | null`.
2. **`pages: number` idem** — boek without pages moet null kunnen zijn; nu ook `as any`.
3. **`youtubeUrl` vs `sourceUrl`** — lecture heeft beide; voor archive is `youtubeUrl` leeg en `sourceUrl` leidend, maar oude code gebruikte `youtubeUrl` als canonical. Adapter vult beide.
4. **`format`/`level` voor audio/video/document** — `format` is Audio/Video terwijl `type` ook audio/video is => dubbele waarheid. Toekomst: één `ContentType` generiek, `format` deprecaten.
5. **Geen generieke Content lijst** — admin Overview toont nog lectures/books gescheiden; een echte generieke `contents` tabel zou één lijst zijn. Huidige store workaround blijft tot Fase 2B UI herziening.
6. **Scholar/subject mapping via `findLastName` heuristic** — alleen in ArchiveImportPage auto-map; store doet geen auto.

## Advies voor Fase 2B+

- Introduceer `AdminContent` generiek type met `type: ContentType`, `provider: Provider`, `durationMin: number | null`, `pages: number | null`, `year: number | null`, `collectionIdentifier`, `importJobId`, `metadata`.
- Refactor `store.tsx` om `contents: BackendContent[]` direct te bewaren naast `lectures/books` (geen splits, alleen view-filter).
- Update `LectureForm`/`BookForm` om `pages`/`durationMin` als nullable inputs te tonen (placeholder “—” i.p.v. 120/30).
- Vervang `mockFetchArchiveCollection` in `data.ts` door echte backend zodra demo niet meer nodig; behoud alleen `parseArchiveIdentifier` helpers.
  - **Status (Fase 3.9): uitgevoerd.** De mock-generator en de demo-fallback zijn uit `src/admin/data.ts` en `ArchiveImportPage.tsx` verwijderd; de echte backend (`/api/admin/imports/preview|confirm`) is de enige route. Zie docs/FASE3_9_CODEBASE_REVIEW.md.

