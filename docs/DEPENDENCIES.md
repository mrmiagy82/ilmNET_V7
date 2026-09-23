# Dependency Consistency — installed vs declared (2026-09-21)

**Check uitgevoerd op:** `npm list` + `node_modules/*/package.json` na `npm install` (frontend) en `server/npm install`.  
**Node:** v20.20.2, **npm:** 10.8.2

## Frontend ( /package.json )

| Package | Declared (package.json) | Installed (node_modules) | Status |
|---------|------------------------|--------------------------|--------|
| `react` | `19.2.6` (exact) | `19.2.6` | ✅ exact |
| `react-dom` | `19.2.6` | `19.2.6` | ✅ |
| `react-router-dom` | `^7.18.4` | `7.18.4` (resolved 7.18.4) | ✅ caret allows |
| `vite` | `7.3.2` | `7.3.2` | ✅ |
| `typescript` | `5.9.3` | `5.9.3` | ✅ |
| `@types/react` | `19.2.7` | `19.2.7` | ✅ |
| `@vitejs/plugin-react` | `5.1.1` | `5.1.1` | ✅ |
| `tailwindcss` | `4.1.17` | `4.1.17` | ✅ |
| `@tailwindcss/vite` | `4.1.17` | `4.1.17` | ✅ |
| `vite-plugin-singlefile` | `2.3.0` | `2.3.0` | ✅ |

**Vite build:** `vite v7.3.2` ✓ 138 modules, `dist/index.html 567.7 kB gzip 148.84 kB`

## Backend ( server/package.json )

| Package | Declared | Installed | Status | Note |
|---------|----------|-----------|--------|------|
| `fastify` | `^5.3.2` | `5.12.5` | ✅ within ^5 | patch/minor update, compatible |
| `@fastify/cors` | `^11.0.1` | `11.1.0` | ✅ | |
| `@fastify/sensible` | `^6.0.0` | `6.0.0` | ✅ | |
| `prisma` (dev) | `^6.5.0` | `6.19.3` | ✅ within ^6 | major stays 6, 6.19 contains fix |
| `@prisma/client` | `^6.5.0` | `6.19.3` | ✅ | generated client 6.19.3 |
| `typescript` (dev) | `^5.7.3` | `5.9.3` | ⚠️ installed newer | declared `^5.7.3` allows `5.9.3` (caret). Frontend pins `5.9.3` exact. Aanbevolen: server ook `5.9.3` pinnen voor 100% sync — nu functioneel identiek, geen break. |
| `tsx` | `^4.19.2` | `4.19.3` | ✅ | |
| `zod` | `^3.24.2` | `3.24.2` | ✅ | |
| `slugify` | `^1.6.6` | `1.6.6` | ✅ | |
| `dotenv` | `^16.5.0` | `16.5.0` | ✅ | |

**Prisma validate:** `The schema at prisma/schema.prisma is valid 🚀` (6.19.3, update available 8.0.0-rc.15 not applied)  
**Prisma generate:** `Generated Prisma Client (v6.19.3)`  
**Backend build:** `tsc -p tsconfig.json → 0 errors, 2.1s`

## Conclusie consistentie

- Alle 6 gevraagde packages (React, Vite, TypeScript, Fastify, Prisma, @prisma/client) **geïnstalleerd en compatibel** met declared ranges. Geen mismatch die build breekt.
- Enige drift: `typescript` server `^5.7.3` resolves naar `5.9.3` (zelfde als frontend). Voor strikte sync kan `server/package.json` aangepast worden naar `5.9.3` exact; nu binnen caret dus acceptabel.
- `fastify` `5.12.5` vs `5.3.2` en `prisma` `6.19.3` vs `6.5.0` zijn beide binnen `^` en bevatten alleen non-breaking fixes. Documentatie bijgewerkt naar **daadwerkelijk geïnstalleerd** versies.
- `package-lock.json` behoudt exacte installed versies voor reproduceerbaarheid.

## Actie

Geen verplichte package.json wijziging nodig voor audit; optioneel voor volgende sprint:

```diff
- "typescript": "^5.7.3",
+ "typescript": "5.9.3",
```

om frontend/backend identiek te pinnen. Voor nu laten we `^5.7.3` staan (werkt) en documenteren hier.

