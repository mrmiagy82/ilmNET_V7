# ilmNet — Deployment runbook (productie)

Alles wat je nodig hebt om ilmNet op een echte server te zetten. Getest tegen
PostgreSQL 17 + Node 20 in productiemodus (`NODE_ENV=production`), met een verse database,
een persistent uploads-volume en de volledige testset (server-suites + browser-e2e).

- **Bouwstenen:** Fastify API (`server/`) + gebouwde frontend (`dist/`, één bestand) + PostgreSQL.
- **Twee vormen:** (A) één service — de API serveert ook de frontend; (B) gesplitst — frontend apart
  (nginx/CDN), API alleen. Vorm A is de standaard.

---

## 1. Environment variables

| Variabele | Verplicht | Betekenis |
| --- | --- | --- |
| `DATABASE_URL` | ja | Postgres-URL, bv. `postgresql://user:pass@host:5432/ilmnet?schema=public` |
| `NODE_ENV` | ja (prod) | `production` → admin-token verplicht, CORS-wildcard verboden, `secure`-cookies/fallbacks uit |
| `ADMIN_TOKEN` | alleen als `ADMIN_LEGACY_TOKEN=true` | Uniek geheim, **minimaal 16 tekens** (`openssl rand -hex 32`). Alleen de fallback voor scripts/CI naast de sessie-login; in productie staat dit pad **standaard uit** (Fase 5.3). Bekende dev-/voorbeeldwaarden worden geweigerd |
| `ADMIN_LEGACY_TOKEN` | nee | `true`/`false`. Zonder waarde: **aan in development, uit in productie** (Fase 5.3). Op `true` in productie is `ADMIN_TOKEN` verplicht; op `false` moet er minstens één actief beheerdersaccount bestaan, anders weigert de server te starten |
| `CORS_ORIGIN` | ja | Exacte browser-origin(s) die de API mogen aanroepen, kommagescheiden. `*` is verboden in prod |
| `HOST` / `PORT` | nee | Default `0.0.0.0` / `3001` |
| `UPLOADS_DIR` | sterk aanbevolen | Map voor custom thumbnails/covers — **op een persistent volume** |
| `YOUTUBE_API_KEY` | optioneel | **Alleen server-side.** Zet hem in de procesomgeving om de officiële YouTube Data API v3 te gebruiken voor de import (exacte duur/datum + `status.embeddable`); zonder key leest ilmNet de publieke YouTube-pagina's. Nooit in `VITE_*`, de database of de frontend |
| `SERVE_FRONTEND` | nee | `true` (default) laat de API de build uit `FRONTEND_DIR` serveren; `false` = API only |
| `FRONTEND_DIR` | nee | Locatie van de frontend-build; default `<repo>/dist` |
| `TRUST_PROXY` | nee | **Wie mag `X-Forwarded-*` zetten?** Default leeg/`false`: niets wordt vertrouwd (het socket-adres is de client). Waarden: `true` (alleen als de API nergens anders bereikbaar is) of een kommagescheiden lijst IPs/CIDR's, bv. `127.0.0.1` of `10.0.0.0/8`. Een hop-count (`2`) wordt geweigerd — zie §5c |
| `PUBLIC_ORIGIN` | sterk aanbevolen | Canonieke origin, bv. `https://ilmnet.example`. Bepaalt het doel van de HTTP→HTTPS-redirect en de HSTS-beslissing; als hij gezet is, komt het redirect-doel **nooit** uit het request |
| `ALLOWED_HOSTS` | nee | Extra hostnamen die als redirect-doel mogen gelden (kommagescheiden). Zelden nodig; `PUBLIC_ORIGIN` en `CORS_ORIGIN` zijn meestal genoeg |
| `HSTS_MAX_AGE` | nee | HSTS-max-age in seconden (default 31536000 = 1 jaar). De header gaat **alleen** mee op requests die echt via HTTPS binnenkomen. `0` schakelt HSTS uit |
| `FORCE_HTTPS` | nee | `true` (alleen productie): elk http-request krijgt een **308** naar https. Alleen aanzetten als de proxy `x-forwarded-proto` doorgeeft — zie §5b |
| `ADMIN_ALLOW_LOCALHOST` | nee | Alleen dev: `false` dwingt het token ook op localhost af |
| `SEED_ALLOW_RESET` | nee | Alleen bewust: laat de **destructieve** demo-seed in productie toe |

Frontend-build (root `.env.example`): `VITE_API_URL` leeg laten in vorm A (zelfde origin).
Zet **nooit** een token of wachtwoord in een `VITE_*`-variabele — vite inlined elke `VITE_*`-waarde in
de publieke JavaScript-bundle. Sinds Fase 4.5 voert de beheerder gebruikersnaam + wachtwoord in op
`/admin`; de API antwoordt met een `HttpOnly; Secure; SameSite=Lax`-sessiecookie en de browser bewaart
zelf **niets** (geen `localStorage`, geen `sessionStorage`). `VITE_ADMIN_TOKEN` is vervallen.

### Hoe env-vars gelezen worden (belangrijk)

De server kent de **herkomst** van elke variabele: de procesomgeving (systemd `EnvironmentFile`,
`docker compose environment:`, een PaaS-env-paneel, `docker run --env-file`) is leidend; een
`.env`-bestand in de servermap is er **alleen voor lokaal ontwikkelen**. Bij het starten gelden
deze regels:

1. **Modus** — `NODE_ENV` uit de procesomgeving wint; anders de waarde uit `.env`; anders
   `development`.
2. **Geen stille terugval** — draagt de procesomgeving deploymentconfiguratie (`DATABASE_URL`,
   `ADMIN_TOKEN`, `CORS_ORIGIN` of `UPLOADS_DIR`) maar is `NODE_ENV` daar niet gezet, dan weigert de
   server te starten in plaats van stil naar development te vallen. Zet `NODE_ENV=production`
   (deployment) of expliciet `NODE_ENV=development` (lokale run met eigen database).
3. **Een `.env` mag productie niet configureren** — in productie mogen `NODE_ENV`, `ADMIN_TOKEN`,
   `CORS_ORIGIN` en `ADMIN_ALLOW_LOCALHOST` niet uit een `.env`-bestand komen. Gebeurt dat toch, dan
   stopt de server met een melding die het bestand én de variabelen noemt.
4. **Tokenkwaliteit** — in productie moet `ADMIN_TOKEN` minimaal 16 tekens hebben en mag het geen
   bekende dev-/voorbeeldwaarde zijn (zoals `change-me-dev-only` of het token uit dit project).

> **Zet dus nooit een `.env` in de app-map van een productiehost.** De server leest zo'n bestand
> niet alleen zelf (dotenv), maar ook via de Prisma-client, ongeacht de werkmap. In Docker is dat
> al afgedekt (`server/.dockerignore` houdt `.env` buiten de image); op een host waar je de service
> direct start moet je het bestand verwijderen. Lokale ontwikkeling (`npm run dev`, de testsuites,
> `npm run seed`) blijft gewoon op `server/.env` werken.

---

## 2. Deploy — zonder Docker (systemd/pm2)

```bash
# 1. code + dependencies
git pull
npm ci                 # root (frontend + e2e)
cd server && npm ci    # API

# 2. bouwen
npm run build          # in repo-root  → dist/index.html (single file)
cd server && npx prisma generate && npm run build   # → server/dist/server.js

# 3. database bijwerken (idempotent, nooit destructief)
npx prisma migrate deploy

# 4. referentiedata (alleen nodig bij een verse database; idempotent)
npm run seed:reference     # 11 subjects + 8 scholars, raakt bestaande content nooit

# 5. starten (migreert eerst, dan de server — zelfde volgorde als de container)
npm run deploy             # = prisma migrate deploy && node dist/server.js
```

Draai dit onder een process manager of systemd, met de env-vars uit §1. Voorbeeld:

```ini
# /etc/systemd/system/ilmnet.service
[Service]
WorkingDirectory=/srv/ilmnet/server
EnvironmentFile=/etc/ilmnet/ilmnet.env      # DATABASE_URL, ADMIN_TOKEN, CORS_ORIGIN, PUBLIC_ORIGIN,
                                          # TRUST_PROXY, UPLOADS_DIR (nooit een .env in de appmap)
ExecStart=/usr/bin/node dist/server.js
Restart=always
Environment=NODE_ENV=production
```

**Reverse proxy (nginx/Caddy):** stuur het hele domein naar de Node-service; de API doet de
SPA-fallback voor `/lectures`, `/books`, `/content/…` enz. Zet de publieke URL in `CORS_ORIGIN`.
Bij vorm B (frontend apart): bouw de frontend met `VITE_API_URL=https://api.example.com` en zet
`SERVE_FRONTEND=false`.

---

## 3. Deploy — met Docker

```bash
# verse database + volumes
ADMIN_TOKEN=$(openssl rand -hex 32) CORS_ORIGIN=https://ilmnet.example \
  docker compose -f server/docker-compose.yml up -d --build

# eenmalig bij een verse database: referentiedata toevoegen
# (de image bevat server/dist, dus gebruik de gecompileerde seed — geen tsx/src nodig)
docker compose -f server/docker-compose.yml exec server node dist/seed.js --reference
```

Wat de artifacts al regelen:

- `server/Dockerfile` — multi-stage `node:20-alpine`, non-root (`USER node`), healthcheck op
  `/api/health`, start met `npx prisma migrate deploy && node dist/server.js`, mountpoint
  `/app/uploads`.
- `server/docker-compose.yml` — Postgres 17 met healthcheck, `ADMIN_TOKEN` én `POSTGRES_PASSWORD`
  verplicht (`:?`, geen default meer), `CORS_ORIGIN` expliciet, `UPLOADS_DIR=/app/uploads` op volume
  `uploads_data`, en de frontend-build read-only op `/app/frontend` (`../dist` uit de repo).
  **Netwerk (Fase 5.2):** Postgres publiceert geen poort meer (`expose` op het composnetwerk) en de
  API staat op `127.0.0.1:3001` — alleen een proxy op de host kan erbij. `TRUST_PROXY` staat in dit
  bestand standaard op `false`; zet het op de proxy of op `true` als poort 3001 nergens anders
  bereikbaar is (§5c).
- `server/.dockerignore` — houdt `.env`, `uploads/`, `node_modules/`, `dist/` en tests buiten de
  image, zodat er geen secrets of lokale state meebakken.

---

## 4. Seed — belangrijk

De seed kent twee modi:

| Commando | Wat het doet | Veilig in productie |
| --- | --- | --- |
| `npm run seed:reference` | Upsert van subjects + scholars. Raakt **geen** content. Idempotent. | ✅ ja — gebruik dit bij een verse DB |
| `npm run seed` | **Wist alles** (content, scholars, subjects, importjobs) en zet demodata neer | ❌ nee — weigert bij `NODE_ENV=production` |

De demo-seed stopt in productie met een duidelijke melding en exit-code 1. Alleen als je een
productiedatabase bewust wilt leegvegen: `SEED_ALLOW_RESET=true npm run seed`.

---

## 4b. Beheerdersaccounts (Fase 4.5)

Er is geen account-UI en geen seed die accounts aanmaakt: de eerste beheerder wordt **op de server**
aangemaakt. Dat is met opzet — een wachtwoord hoort nooit door een browser of een SQL-client te gaan.

```bash
cd server
npm run admin:create -- --username admin --password '<lang, uniek wachtwoord>' [--name 'Weergavenaam']
npm run admin:list                    # wie bestaan er, rollen, laatste login, actieve sessies
npm run admin:password -- --username admin --password '<nieuw>'   # trekt alle sessies van dat account in
npm run admin:disable -- --username admin                         # idem, account geblokkeerd
npm run admin:enable  -- --username admin
```

- Wachtwoordbeleid: minimaal 10 tekens, geen bekende standaardwaarde, niet gelijk aan de gebruikersnaam;
  opslag met scrypt (`node:crypto`).
- Sessies: 12 uur standaard (`ADMIN_SESSION_TTL_MINUTES`, 5 minuten – 30 dagen), rollend bij gebruik,
  harde grens 30 dagen; uitloggen verwijdert de sessierij direct.
- **TLS is verplicht**: de cookievlag `Secure` betekent dat browsers de sessie alleen bewaren op HTTPS
  (of op `localhost`/`127.0.0.1`). Zonder TLS lijkt de login te slagen en valt de CMS daarna terug op
  het loginscherm — zie §7.
- Mislukte pogingen worden geremd: 5 per gebruikersnaam+IP en 20 per IP per 15 minuten → `429` met
  `Retry-After`.
- Sinds Fase 5.3 is de oude `ADMIN_TOKEN` in productie **uit** tenzij je `ADMIN_LEGACY_TOKEN=true` zet;
  zonder accounts én zonder token weigert de server te starten. Zie §5d.

## 5. Verificatie na elke deploy

```bash
curl -s https://ilmnet.example/api/health   # status ok, database up, storage.writable true, adminProtection "sessions" (of "sessions+legacy-token")
curl -s https://ilmnet.example/api/ready    # status ready + database up (goedkope probe voor een load balancer)
```

- `/` en diepe links (`/lectures`, `/books`, `/series/<id>`, `/lectures/<slug>`) geven 200 en
  renderen na een harde refresh (SPA-fallback).
- Admin: `/admin` vraagt om gebruikersnaam + wachtwoord; na inloggen verschijnen drafts, imports en uploads (het dashboard toont de echte totalen).
- Upload-test: voeg in het CMS een thumbnail toe, herlaad de pagina — het bestand moet daarna nog
  steeds geserveerd worden (bewijs dat `UPLOADS_DIR` op een volume staat).
- **Netwerk:** `ss -ltnp` (of `docker compose ps`) toont géén Postgres-poort op een publiek
  interface, en de API-poort alleen op loopback/het interne netwerk. Zie §5c voor de proxy-instelling.
- **Proxy:** het opstartlog zegt welke proxy's vertrouwd zijn; een mislukte login logt het echte
  client-IP (niet het proxy-adres).
- Bij het starten logt de server de storage-audit, bv.
  `Upload storage ready at /var/lib/ilmnet/uploads — 3 referenced file(s), 0 unused on disk`.
  Staat er `Missing upload file(s) referenced by the database: …`, dan is het volume niet gemount.

---

## 5b. TLS, HTTPS, HSTS en HTTP→HTTPS (Fase 5.1)

De admin-login gebruikt een cookie met de vlag `Secure`: **zonder HTTPS werkt `/admin` niet** (de
browser bewaart de cookie dan niet en je valt steeds terug op het loginscherm). Regel daarom TLS bij
de laag vóór de app — de app zelf termineert geen TLS en er is bewust geen provider gekozen.

**Wat de app doet (geen configuratie nodig):**

- op elk request dat via HTTPS binnenkomt (direct, of via een proxy die `x-forwarded-proto: https`
  zet) antwoordt de API met `Strict-Transport-Security: max-age=31536000`. Over platte http wordt de
  header **niet** gestuurd (browsers negeren hem daar toch, en hij zou misleiden);
- `includeSubDomains`/`preload` worden **niet** gezet: voeg die pas toe bij de proxy als *alle*
  subdomeinen HTTPS-only zijn;
- `Referrer-Policy: strict-origin-when-cross-origin` blijft staan — die is verplicht voor de
  YouTube-embeds (Fase 4.3.1). Een proxy of CDN mag deze header **niet** overschrijven naar
  `same-origin`/`no-referrer`, anders krijg je “Error 153” in de speler.

**Wat de proxy moet doen:**

1. TLS termineren (certificaat via de gebruikelijke route van je host/platform);
2. `X-Forwarded-Proto` doorgeven aan de app (anders krijgt de app nooit `https` te zien en dus ook
   geen HSTS);
3. http → https omleiden (permanent). Dat mag bij de proxy of in de app:
   `FORCE_HTTPS=true` laat de app zelf een **308** terugsturen (308 behoudt methode en body, dus een
   admin-POST wordt geen GET). Health-endpoints blijven bewust over http bereikbaar, zodat een
   container-`HEALTHCHECK` op de app-socket blijft werken;
4. `/api/health` blijft ongewijzigd doorwerken voor orchestrators.

**Controleren na de deploy (5 minuten):**

```bash
curl -sI https://<domein>/ | grep -iE "strict-transport-security|referrer-policy"
#   strict-transport-security: max-age=31536000
#   referrer-policy: strict-origin-when-cross-origin
curl -sI http://<domein>/ | head -1        # 308 (of 301) naar https
curl -s https://<domein>/api/health        # status ok, database up, storage.writable true
```

In de browser: DevTools → Network → filter `embed/` → het YouTube-request moet een `Referer` hebben.
Ontbreekt die, dan onderdrukt een laag de `Referrer-Policy` en breekt de speler (zie §7e in
`docs/CONTEXT.md`).

---

## 5c. Reverse proxy, forwarded headers en client-IP (Fase 5.2)

De API draait achter een reverse proxy die TLS termineert. Alles wat de proxy doorgeeft is **invoer
van buiten** en wordt daarom alleen gebruikt als je zegt welke proxy vertrouwd mag worden.

### De drie headers en waarom ze uitmaken

| Header | Waarvoor de app hem gebruikt | Risico zonder begrenzing |
| --- | --- | --- |
| `X-Forwarded-For` | het client-IP: de login-throttle (5 per gebruiker+IP), `AdminSession.ip` en de logs | Een client kiest zelf een IP → throttle per IP te omzeilen en sessies/logs vervuilen |
| `X-Forwarded-Proto` | `req.protocol` → of HSTS meegaat en of een request als HTTPS geldt | Een client claimt HTTPS op een http-verbinding → de app stuurt HSTS over onversleuteld verkeer |
| `X-Forwarded-Host` | het doel van de HTTP→HTTPS-redirect | Open redirect: een aanvaller bepaalt naar welke host een bezoeker wordt gestuurd |

Daarom: **`trustProxy` staat standaard uit** (tot Fase 5.2 stond hij hard op `true`, wat betekende dat
élke client deze drie headers mocht zetten).

### Instellen

```bash
# Aanbevolen: precies de proxy (of het proxy-netwerk) vertrouwen
TRUST_PROXY=127.0.0.1            # proxy op dezelfde host
TRUST_PROXY=10.0.0.0/8           # proxy in een privaat netwerk
TRUST_PROXY=127.0.0.1,10.0.0.0/8 # meerdere

# Alleen als de API uitsluitend via de proxy bereikbaar is (poort niet gepubliceerd, bind op
# 127.0.0.1 of alleen op het interne netwerk):
TRUST_PROXY=true
```

- **Geen hop-count** (`TRUST_PROXY=2`): die vertrouwt stil de verkeerde hop zodra de topologie
  verandert. De server weigert zo'n waarde bij het starten.
- Zonder `TRUST_PROXY` is `req.ip` het adres van de proxy zelf. Dat is niet gevaarlijk, maar betekent
  dat de login-throttle alle beheerders als één bezoeker ziet (de brede limiet is 20 mislukte
  pogingen per IP per 15 minuten) en dat `AdminSession.ip` het proxy-adres vastlegt. De server zegt
  dit expliciet in het opstartlog.
- `FORCE_HTTPS=true` zonder vertrouwde proxy wordt **geweigerd bij het starten**: de app ziet dan
  altijd `http` en zou elke request naar zichzelf verwijzen. Hetzelfde geldt voor `FORCE_HTTPS=true`
  zonder enig toegestaan redirect-doel (`PUBLIC_ORIGIN` of een host in `CORS_ORIGIN`/`ALLOWED_HOSTS`).

### De proxy zelf

```nginx
# nginx — TLS termineren, forwards doorgeven, http → https
server {
    listen 443 ssl;
    server_name ilmnet.example;
    # ssl_certificate …  (certificaat via je eigen route: certbot, platform, …)

    location / {
        proxy_pass         http://127.0.0.1:3001;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   X-Forwarded-Host  $host;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_read_timeout 60s;      # import-previews van archive.org/YouTube kunnen even duren
        client_max_body_size 6m;     # uploads zijn max 5 MB
    }
}
server {
    listen 80;
    server_name ilmnet.example;
    return 308 https://$host$request_uri;   # of laat de app dit doen met FORCE_HTTPS=true
}
```

`X-Forwarded-For` moet door de proxy **gezet** worden (niet doorgegeven wat de client stuurde):
`$proxy_add_x_forwarded_for` voegt het echte adres toe. Zet bij Cloudflare/CDN bovendien dat de
`Referrer-Policy`-responsheader niet wordt overschreven (anders breekt de YouTube-speler, §7e van
`docs/CONTEXT.md`).

### Controleren

```bash
# 1. De app moet de proxy vertrouwen: in het opstartlog
#      Proxy trust: TRUST_PROXY trusted proxies: 127.0.0.1
#    of, als het uit staat én je zit in productie:
#      Client IP source: the socket address. Behind a reverse proxy every request therefore looks …
journalctl -u ilmnet -n 30 --no-pager | grep -E "Proxy trust|Client IP source"

# 2. Doorvoer van het echte client-IP: doe een mislukte login en kijk welk IP gelogd wordt
#    (het moet jouw adres zijn, niet 127.0.0.1 van de proxy)
journalctl -u ilmnet -n 5 --no-pager | grep -i "sign-in rejected"

# 3. HSTS alleen op https, en het redirect-doel klopt
curl -sI https://ilmnet.example/api/health | grep -i strict-transport-security
curl -sI http://ilmnet.example/ | head -1        # 308 (of 301) — nooit naar een vreemde host
```

---

## 5d. Wie mag inloggen: sessies eerst, legacy-token standaard uit (Fase 5.3)

Beheerders loggen in met gebruikersnaam + wachtwoord; de API zet een `HttpOnly`-sessiecookie. Daarnaast
bestond de oude gedeelde `ADMIN_TOKEN` als "dual-mode" fallback voor scripts en CI. Zo'n string is één
niet-intrekbare sleutel tot álle adminrechten, dus in productie staat dat pad sinds Fase 5.3 **uit**
tenzij je het expliciet aanzet.

| `ADMIN_LEGACY_TOKEN` | `ADMIN_TOKEN` | Gedrag in productie |
| --- | --- | --- |
| niet gezet | — | **Alleen sessies.** Een `ADMIN_TOKEN` in de omgeving is dan een rondslingerend geheim: de app waarschuwt bij het starten en negeert het |
| `false` | — | Idem, expliciet. Er moet minstens één actief account bestaan, anders weigert de server te starten (anders kan niemand er ooit in) |
| `true` | gezet (≥16 tekens, geen bekende waarde) | Token werkt naast sessies — voor CI/scripts die geen browser hebben |
| `true` | leeg | Server weigert te starten (`ADMIN_LEGACY_TOKEN=true is set, but ADMIN_TOKEN is missing`) |

```bash
# Eenmalig op de host: het eerste account (daarna kan de CLI-token weg)
cd server && npm run admin:create -- --username <naam> --password '<lang, uniek>'
npm run admin:list            # controleer dat er een actief account staat

# Controleren dat het legacy pad uit staat (dit hoort 401 te zijn)
curl -s -o /dev/null -w '%{http_code}\n' -H "x-admin-token: $ADMIN_TOKEN" https://ilmnet.example/api/admin/contents
```

Het opstartlog zegt de effectieve postuur, bijvoorbeeld
`Admin protection: session sign-in enabled (2 active accounts) · legacy ADMIN_TOKEN disabled`.
`/api/health` herhaalt het zonder geheimen: `adminProtection: "sessions"` of `"sessions+legacy-token"`.

**Wil je het token echt weg hebben:** `npm run admin:password`/`admin:disable` trekken sessies in, en
het verwijderen van `ADMIN_TOKEN` uit de serviceomgeving (plus `ADMIN_LEGACY_TOKEN` weglaten) maakt het
token per direct waardeloos. Roteren kan zonder uitval: eerst een nieuw account, dan het token weg.

---

## 6. Updaten en terugrollen

1. `git pull` → `npm ci` (root + server) → `npm run build` + `server: npm run build`.
2. `npx prisma migrate deploy` (idempotent; migraties zijn additief).
3. Service herstarten (`systemctl restart ilmnet` / `docker compose up -d --build`).

Uploads staan buiten de image op een volume en blijven dus staan bij een redeploy; de database
verwijst naar `/uploads/<bestand>` en de server controleert bij het opstarten of die bestanden er
zijn. Rollback = vorige image/commit terugzetten en opnieuw starten; migraties zijn voorwaarts
geschreven, dus draai geen `migrate reset` op productie.

---

## 6b. Backup en herstel (Fase 5.1)

De database én de uploads-map zijn samen de hele site: de content, de scholars/subjects, de
beheerdersaccounts **en** de bestanden die de database als `/uploads/<bestand>` aanwijst. Docker-volumes
(`postgres_data`, `uploads_data`) zijn geen backup: ze staan op dezelfde host en verdwijnen mee met een
verkeerd commando. De scripts staan in `ops/` en gebruiken alleen `pg_dump`, `pg_restore`, `psql` en
coreutils — dus niets extra te installeren.

### Back-up maken

```bash
DATABASE_URL="postgresql://ilmnet:pass@localhost:5432/ilmnet?schema=public" \
UPLOADS_DIR=/var/lib/ilmnet/uploads \
BACKUP_DIR=/var/backups/ilmnet \
RETENTION_DAYS=14 \
ops/backup.sh
```

Dat schrijft een set van drie bestanden (rechten 0600, want de dump bevat wachtwoord-hashes):

| Bestand | Inhoud |
| --- | --- |
| `ilmnet-db-<tijdstip>.dump` | `pg_dump --format=custom` — compleet en per object terug te zetten |
| `ilmnet-uploads-<tijdstip>.tar.gz` | de uploads-map (custom thumbnails/covers) |
| `ilmnet-manifest-<tijdstip>.txt` | rij-aantallen op het moment van de back-up + bestandsgroottes + sha256 |

Na `RETENTION_DAYS` ruimt het script oudere sets zelf op. Prisma-parameters in `DATABASE_URL`
(`?schema=public`, `connection_limit`) worden automatisch uit de URL gefilterd voordat `pg_dump`
hem ziet; dezelfde URL werkt dus voor de app én voor de back-up.

**Automatisch (aanbevolen):** `ops/systemd/ilmnet-backup.service` + `ilmnet-backup.timer` draaien de
back-up elke nacht (02:30, met random vertraging). Installeer ze en zet de variabelen in
`/etc/ilmnet/backup.env` (voorbeeld: `ops/systemd/backup.env.example`):

```bash
sudo install -d -m 0750 /etc/ilmnet
sudo install -m 0600 ops/systemd/backup.env.example /etc/ilmnet/backup.env
sudo editor /etc/ilmnet/backup.env
sudo cp ops/systemd/ilmnet-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now ilmnet-backup.timer
systemctl list-timers ilmnet-backup.timer
```

Zonder systemd (cron):

```cron
30 2 * * * cd /opt/ilmnet && set -a && . /etc/ilmnet/backup.env && set +a && ops/backup.sh >> /var/log/ilmnet-backup.log 2>&1
```

**Buiten de host bewaren:** `BACKUP_DIR` hoort op een andere schijf dan de database, en de set hoort
daarna gekopieerd te worden naar opslag buiten de server (rsync/object-storage naar keuze). Een
back-up op dezelfde host beschermt niet tegen schijfuitval of een verkeerde `rm`. Versleutel de
doelopslag: de dump bevat de scrypt-hashes van de beheerdersaccounts.

### Terugzetten

```bash
# naar een lege database (DROP + CREATE), inclusief uploads
ops/restore.sh --dump /var/backups/ilmnet/ilmnet-db-<tijdstip>.dump \
               --database-url "postgresql://ilmnet:pass@localhost:5432/ilmnet" \
               --uploads /var/backups/ilmnet/ilmnet-uploads-<tijdstip>.tar.gz \
               --recreate --yes
```

- De **doel-database moet je expliciet noemen** (`--database-url`); er is geen impliciete
  “herstel over wat `DATABASE_URL` toevallig is”.
- `--recreate` (DROP + CREATE) vraagt aanvullend `--yes`; zonder die vlag stopt het script.
- Zonder `--recreate` herstelt het script in een bestaande database met `--clean --if-exists`.
- De uploads-map wordt **nooit** stil overschreven: staat daar al iets, dan is `--force` nodig.
- Draai daarna `npx prisma migrate deploy` als de dump ouder is dan de nieuwste migratie, herstart de
  API en controleer `GET /api/health` + een paar pagina's.

### De oefening (verplicht, 1 minuut)

Een back-up die nooit is teruggezet is een aanname. `ops/restore-drill.sh` bewijst het zonder de
live-omgeving aan te raken: hij zet de nieuwste set terug in een **wegwerp-database**
(`ilmnet_restore_drill`) en een **tijdelijke uploads-map**, en vergelijkt daarna de rij-aantallen en
de sha256 van elk bestand met het manifest.

```bash
DATABASE_URL="postgresql://ilmnet:pass@localhost:5432/ilmnet?schema=public" \
BACKUP_DIR=/var/backups/ilmnet UPLOADS_DIR=/var/lib/ilmnet/uploads ops/restore-drill.sh
# → drill PASSED — the backup set restores into an empty database with matching counts.
```

Draai deze oefening bij de eerste deploy en daarna bijvoorbeeld maandelijks; een `FAIL` betekent dat
je back-up niet terug te zetten is en dat je dat **nu** wilt weten.

### Wat er bewust niet in de back-up zit

`.env`-bestanden en secrets (die horen in de procesomgeving/een secret manager), de reverse-proxy-
config en het TLS-certificaat. Noteer die apart, zodat een herstel op een nieuwe host compleet is.

---

## 7. Problemen oplossen

| Symptoom | Oorzaak / oplossing |
| --- | --- |
| Server start niet met een boodschap over `ADMIN_TOKEN` | Sinds Fase 5.3 draait productie standaard op accounts. Alleen met `ADMIN_LEGACY_TOKEN=true` is `ADMIN_TOKEN` verplicht (en dan ≥16 tekens, geen bekende waarde) — zie §5d. |
| `A .env file may not configure a production boot: …` | Er staat een (dev-)`.env` in de servermap die `NODE_ENV`/`ADMIN_TOKEN`/`CORS_ORIGIN` zou leveren. Verwijder het bestand van de productiehost of zet die variabelen in de serviceomgeving. |
| `NODE_ENV is not set in the process environment, but deployment configuration was found there` | Je start met een echte `DATABASE_URL`/`ADMIN_TOKEN`/`CORS_ORIGIN`, maar zonder `NODE_ENV`. Zet `NODE_ENV=production` (deployment) of `NODE_ENV=development` (lokale run). |
| `ADMIN_TOKEN is too short for production` / `ADMIN_TOKEN is a known development/example value` | Genereer een nieuw token: `openssl rand -hex 32`. |
| `CORS_ORIGIN="*" is not allowed in production` | Zet de exacte publieke origin(s) in `CORS_ORIGIN`. |
| `P1012` / `Environment variable not found: DATABASE_URL` | `DATABASE_URL` ontbreekt of is leeg in de procesomgeving. |
| Admin geeft 401 | Niet (meer) ingelogd, of een verlopen/ingetrokken sessie: opnieuw inloggen. Bestaat er nog geen account, maak er dan een met `npm run admin:create` (een lege `admin_users`-tabel betekent dat elke login 401 geeft). |
| `No way in: the legacy ADMIN_TOKEN is disabled in production and the admin_users table has no active account` | Er is geen account en het token staat uit: maak eerst een account (`npm run admin:create`), of zet voor CI/scripts `ADMIN_LEGACY_TOKEN=true` mét een sterk `ADMIN_TOKEN` (Fase 5.3, §5d). |
| `ADMIN_TOKEN is set but the legacy token path is disabled in production` (waarschuwing) | Het token is genegeerd. Haal `ADMIN_TOKEN` uit de serviceomgeving, of zet `ADMIN_LEGACY_TOKEN=true` als een script het echt nodig heeft. |
| `ADMIN_LEGACY_TOKEN=true is set, but ADMIN_TOKEN is missing` | Zet een productie-waardig `ADMIN_TOKEN` (`openssl rand -hex 32`) óf laat `ADMIN_LEGACY_TOKEN` weg om alleen op accounts te draaien. |
| Upload geeft `415 … The uploaded bytes are not a supported image` | De bestandsinhoud is geen jpg/png/webp/gif/avif, ook al zegt de client iets anders (Fase 5.3 controleert de magic bytes). Converteer het bestand of kies een ander. |
| `400 CONFIRM_REQUIRED` bij `DELETE …?hard=true` | Een hard delete moet de record noemen: `?hard=true&confirm=<id|slug>`. Wil je alleen verbergen, gebruik dan `DELETE` zónder `hard=true` (archiveert; terug te zetten). |
| Login lukt, maar de CMS valt direct terug op het loginscherm | De sessiecookie is `Secure` en de site draait op platte `http://` (niet localhost). Zet TLS voor de reverse proxy of gebruik `https://`. |
| `429 Too many sign-in attempts` | Throttle: 5 mislukte pogingen per gebruikersnaam+IP (20 per IP) per 15 minuten. Wacht het venster af of herstart de API (de teller is in-process). |
| Wachtwoord vergeten / account kwijt | Op de server: `npm run admin:password -- --username <naam> --password '<nieuw>'` (trekt bestaande sessies in). |
| YouTube-import werkt, maar zonder exacte duur/embeddable-status | Geen `YOUTUBE_API_KEY` in de serveromgeving: ilmNet leest dan de publieke pagina's. Zet de key in de procesomgeving voor de officiële Data API (server-side, nooit in een `VITE_*`-variabele) |
| YouTube-import meldt "Data API unavailable … falling back" | Key ongeldig, quotum op of Google onbereikbaar; de import gaat verder via de publieke pagina's. De melding bevat nooit de key zelf |
| Thumbnails 404, boot-waarschuwing over ontbrekende uploads | `UPLOADS_DIR` staat niet op een persistent volume, of het volume is niet gemount. |
| Diepe link geeft 404 | Reverse proxy onderschept de route; stuur alles naar de Node-service of zet `SERVE_FRONTEND=true`. |
| Archive-import faalt met `ARCHIVE_FETCH_FAILED` | Tijdelijke rate-limit bij archive.org — opnieuw proberen. |
| `pg_dump: error: invalid URI query parameter: "schema"` | Alleen als je `pg_dump` handmatig met de Prisma-URL aanroept. `ops/backup.sh` filtert Prisma-parameters (`schema`, `connection_limit`, …) er zelf uit; doe dat handmatig ook, of laat `?schema=public` weg |
| Na het terugzetten zijn thumbnails 404 | De uploads zijn niet (of in een andere map) teruggezet: controleer `UPLOADS_DIR` en de bootregel `Upload storage ready …` resp. `Missing upload file(s) …` |
| `drill FAILED` bij een rij-aantal | De set is incompleet of hoort bij een andere database. Maak een nieuwe back-up en herhaal de drill; zet niets terug voordat de drill slaagt |
| `FORCE_HTTPS=true requires TRUST_PROXY` bij het starten | De app ziet zonder vertrouwde proxy alleen `http` en zou oneindig naar zichzelf redirecten. Zet `TRUST_PROXY` op het proxy-adres/CIDR, of laat de redirect aan de proxy (§5c) |
| `FORCE_HTTPS=true needs a redirect target` bij het starten | Zet `PUBLIC_ORIGIN=https://<domein>` (aanbevolen) of zorg dat `CORS_ORIGIN`/`ALLOWED_HOSTS` de publieke host bevatten |
| `TRUST_PROXY="2" looks like a hop count` | Gebruik een expliciet adres of CIDR in plaats van een aantal hops (§5c) |
| Bezoekers worden naar een onverwachte host geredirect | Het log toont `Refused to redirect to a host that is not on the allowlist — using the canonical origin`. Zet `PUBLIC_ORIGIN` op het echte domein; dan kan het request het doel niet meer beïnvloeden |
| Login-throttle grijpt te snel aan (alle beheerders lijken één IP) | `TRUST_PROXY` staat uit of is fout: de app ziet het proxy-adres als client. Zet het op het adres/CIDR van de proxy (§5c) en controleer met een mislukte login welk IP gelogd wordt |

---

## 8. Health check (voor orchestrators)

Twee endpoints, met een bewust verschillend doel (Fase 5.2):

| Endpoint | Wat het checkt | Antwoord | Gebruik |
| --- | --- | --- | --- |
| `GET /api/health` (alias `/api/v1/health`) | service + database + uploadopslag | **200** met `{ status, env, database, storage: { persistent, writable, files, bytes }, adminProtection }` · **503** als de database onbereikbaar is of het uploadvolume niet schrijfbaar. Sinds Fase 5.3 zit het **absolute pad** (`storage.dir`) er niet meer in: dit endpoint is publiek | de `HEALTHCHECK` van de Dockerfile en de handmatige verificatie: zegt of het **hele** deployment bruikbaar is |
| `GET /api/ready` (alias `/api/v1/ready`) | alleen de database-ping | **200** met `{ status: "ready", database: "up" }` · **503** met `status: "not_ready"` | readiness-probe van een load balancer/orchestrator: goedkoop, geen bestandsstatistieken |

Beide zijn publiek (geen admin-referenties), read-only en uitgezonderd van de `FORCE_HTTPS`-redirect,
zodat een probe op de app-socket over http blijft werken. Een **liveness**-probe hoort niet naar deze
endpoints te kijken als de database erbij hoort: gebruik `/api/ready` voor "mag er verkeer naartoe" en
herstart een container alleen op basis van `/api/health`-fouten die niet de database betreffen.
