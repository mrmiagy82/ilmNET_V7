# ilmNet operations

Provider-agnostic operational scripts. No dependencies beyond the PostgreSQL client tools
(`pg_dump`, `pg_restore`, `psql`) and coreutils — the same tools every deployment already has.

| Script | What it does |
| --- | --- |
| `backup.sh` | Writes a timestamped set into `BACKUP_DIR`: a `pg_dump --format=custom` of the database, a `tar.gz` of the uploads directory, and a manifest with row counts and sha256 checksums. Applies `RETENTION_DAYS`. |
| `restore.sh` | Puts a backup set back. The target database must be named explicitly; `--recreate` (DROP + CREATE) requires `--yes`; the uploads directory is never overwritten without `--force`. |
| `restore-drill.sh` | Proves a backup set restores: runs `restore.sh` into a throwaway database and a temporary uploads directory, then compares the restored row counts and file checksums against the manifest. Finds the manifest next to the dump (that is how an off-site copy arrives) or in `BACKUP_DIR`; **refuses to run without one** (exit 1) and reports how many comparisons matched — 0 comparisons is a failure (exit 3). |
| `offsite-copy.sh` | Copies the newest (or every) backup set to another host, a mounted volume or an object-store gateway over `rsync` (`cp` fallback for a local target), verifies size + sha256 against the manifest, and prints the restore/drill commands. Refuses targets inside `BACKUP_DIR` or the checkout. |
| `healthcheck.sh` | Watchdog: deep health + readiness, **the release the API reports**, uploads writability, **backup freshness**, free disk space and (optionally) the database. Exits 1 on failure and sends an alert when `ALERT_WEBHOOK_URL`/`ALERT_MAIL_TO` is set. `--quiet` silences a healthy run only: a failing one still writes its FAIL lines, the release and the summary to stderr. |
| `alert.sh` | Sends one alert to a webhook (JSON POST) and/or `mail`, always keeps a copy on stderr, redacts credentials/tokens from the message, and escapes **every** value of the JSON payload (a quote in a subject used to produce invalid JSON at the receiver while the script still exited 0); `--dry-run` shows exactly what would be sent. Used by the watchdog and by the systemd `OnFailure=` units. |
| `deploy-check.sh` | Post-deploy (and post-rollback) smoke test: readiness, deep health + the release it reports, app shell, deep link, `robots.txt`, `sitemap.xml`, favicon, `/admin`, a missing file = 404, gzip, and `--expect-commit` to prove *which* release is live. |
| `logrotate/ilmnet` | Example logrotate config for file-based logs (journald and Docker need their own size limits — see `docs/DEPLOYMENT.md` §9d). |
| `systemd/` | Timers + services: nightly backup (`ilmnet-backup.timer`), 5-minute watchdog (`ilmnet-healthcheck.timer`), the `OnFailure` alert template (`ilmnet-alert@.service`), and example env files for both. |

Full procedure, scheduling, off-site copies and the recovery runbook: `docs/DEPLOYMENT.md`
§ *Backup en herstel*. Monitoring, alerts, logging and the host-only checklist: § *Monitoring, logging
en alarmering* (§9).

Quick start:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/ilmnet" \
UPLOADS_DIR=/var/lib/ilmnet/uploads \
BACKUP_DIR=/var/backups/ilmnet \
ops/backup.sh

DATABASE_URL="postgresql://user:pass@host:5432/ilmnet" ops/restore-drill.sh
# the manifest must sit next to the dump (or in BACKUP_DIR): the drill compares against it and refuses
# to run without one, so "PASSED" always names the number of comparisons that matched
```

```bash
# is the deployment alive, and was it backed up recently?
BASE_URL=http://127.0.0.1:3001 BACKUP_DIR=/var/backups/ilmnet UPLOADS_DIR=/var/lib/ilmnet/uploads \
  ops/healthcheck.sh

# did the deploy/rollback land the release we expected?
BASE_URL=https://ilmnet.example ops/deploy-check.sh --expect-commit "$(git rev-parse --short HEAD)"

# get the sets off this host (then drill from that copy)
OFFSITE_TARGET=backup@backup-host:/srv/ilmnet BACKUP_DIR=/var/backups/ilmnet ops/offsite-copy.sh --latest
```
