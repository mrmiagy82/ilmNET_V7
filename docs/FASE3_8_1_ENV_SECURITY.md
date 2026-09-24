# Fase 3.8.1 — Production env/security hardening

**Probleem (uit de Fase 3.8 sanity check):** een achtergebleven `server/.env` kon in productie via
dotenv én via de Prisma-client `NODE_ENV`, `ADMIN_TOKEN`, `CORS_ORIGIN` en andere waarden laden en
daarmee de production fail-fast bescherming omzeilen — inclusief het bekende dev-token
`change-me-dev-only` uit `.env.example`. Reproduceerbaar: met alleen `DATABASE_URL` in de
procesomgeving startte de server in `[development]` met CORS-origins en een token uit het bestand.

**Opgelost met één env-laag die herkomst kent:** `server/src/lib/env.ts`. De procesomgeving is
leidend, een `.env`-bestand is er alleen voor lokaal ontwikkelen.

## Regels (afgedwongen bij het starten)

| # | Regel | Gedrag |
| --- | --- | --- |
| R1 | Modus | `NODE_ENV` uit de procesomgeving wint, anders de `.env`-waarde, anders `development` |
| R2 | Geen stille terugval | Draagt de procesomgeving deploymentconfiguratie (`DATABASE_URL`, `ADMIN_TOKEN`, `CORS_ORIGIN`, `UPLOADS_DIR`) zonder `NODE_ENV`, dan **weigert** de server: "NODE_ENV is not set in the process environment…" |
| R3 | Geen `.env` in productie | In productie mogen `NODE_ENV`, `ADMIN_TOKEN`, `CORS_ORIGIN` en `ADMIN_ALLOW_LOCALHOST` niet uit een `.env`-bestand komen → **weigeren**, met bestandspad én de betreffende variabelen |
| R4 | Tokenkwaliteit | In productie: minimaal 16 tekens, geen bekende dev-/voorbeeldwaarde (statische lijst + alle waarden uit de aanwezige `.env.example`-bestanden) → **weigeren** |
| R5 | Zichtbaarheid | Wordt er in productie tóch een `.env` gevonden, dan logt de server welke bestanden dat zijn en welke sleutels er (nog) uit komen |

Dezelfde redenering zit in `isProductionSafe()`, die de destructieve demo-seed gebruikt: een
omgeving met deploymentconfiguratie maar zonder expliciete modus geldt daar als productie, dus een
`.env` kan het wissen van de database niet meer uitlokken.

## Bestanden

| Bestand | Wijziging |
| --- | --- |
| `server/src/lib/env.ts` | **nieuw** — provenance (procesomgeving vs. `.env`), modusresolutie, boot-guards, tokenvalidatie |
| `server/src/server.ts` | leest env via de nieuwe laag (geen losse `dotenv.config()` meer) en roept `assertBootConfiguration()` als eerste in `buildApp()` |
| `server/src/seed.ts` | gebruikt `isProductionSafe()` i.p.v. alleen `NODE_ENV` |
| `server/test/env-hardening.test.ts` | **nieuw** — gerichte regressietest (13 checks) |
| `server/test/production.test.ts` | productie-waardig suite-token + checks voor het dev-token en een te kort token |
| `docs/DEPLOYMENT.md`, `server/.env.example`, `server/docker-compose.yml`, `docs/FASE3_7_PRODUCTION_READINESS.md` | documentatie gelijkgetrokken |

## Regressietest

`cd server && npm run test:env` — 13 checks, waaronder echte child-processes tegen een fixture-map
met een stale `.env` (`NODE_ENV=development`, `ADMIN_TOKEN=change-me-dev-only`, lokale CORS):

| Scenario | Verwachting |
| --- | --- |
| Schone productieomgeving (alle guard-variabelen uit de procesomgeving) | start (mode=production) |
| Productie zonder `ADMIN_TOKEN` in de procesomgeving, `.env` zou er een leveren | weigert: `.env file may not configure a production boot` |
| Productie met bekend dev-token in de procesomgeving | weigert: `must never authenticate a production deployment` |
| Productie met te kort token | weigert: `too short for production` |
| Deploymentconfiguratie zonder `NODE_ENV` (`.env` zegt development) | weigert: `NODE_ENV is not set in the process environment` |
| Alleen `.env` (lokaal ontwikkelen) | start (mode=development) |
| Expliciet `NODE_ENV=development` met database-override | start (mode=development) — gedocumenteerde lokale escape |

## Wat er níet is veranderd

Geen UI-, feature- of API-wijzigingen. Lokale ontwikkeling blijft werken zoals voorheen:
`npm run dev`, `npm run test:*`, `npm run seed` en `npm run seed:reference` lezen `server/.env`
onveranderd. Alleen een *productie*-start met een `.env` die de guards zou beïnvloeden wordt nu
geweigerd in plaats van stilzwijgend door te gaan.
