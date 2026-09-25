# ilmNet operations

Provider-agnostic operational scripts. No dependencies beyond the PostgreSQL client tools
(`pg_dump`, `pg_restore`, `psql`) and coreutils — the same tools every deployment already has.

| Script | What it does |
| --- | --- |
| `backup.sh` | Writes a timestamped set into `BACKUP_DIR`: a `pg_dump --format=custom` of the database, a `tar.gz` of the uploads directory, and a manifest with row counts and sha256 checksums. Applies `RETENTION_DAYS`. |
| `restore.sh` | Puts a backup set back. The target database must be named explicitly; `--recreate` (DROP + CREATE) requires `--yes`; the uploads directory is never overwritten without `--force`. |
| `restore-drill.sh` | Proves a backup set restores: runs `restore.sh` into a throwaway database and a temporary uploads directory, then compares the restored row counts and file checksums against the manifest. |
| `systemd/` | Timer + service so the backup runs nightly (`ilmnet-backup.timer`), plus an example `backup.env` file. |

Full procedure, scheduling, off-site copies and the recovery runbook: `docs/DEPLOYMENT.md`
§ *Backup en herstel*.

Quick start:

```bash
DATABASE_URL="postgresql://user:pass@host:5432/ilmnet" \
UPLOADS_DIR=/var/lib/ilmnet/uploads \
BACKUP_DIR=/var/backups/ilmnet \
ops/backup.sh

DATABASE_URL="postgresql://user:pass@host:5432/ilmnet" ops/restore-drill.sh
```
