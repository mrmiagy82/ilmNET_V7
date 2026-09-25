#!/usr/bin/env bash
#
# ilmNet — backup: PostgreSQL dump + uploads archive + manifest + checksums.
#
#   DATABASE_URL=postgresql://user:pass@host:5432/ilmnet?schema=public \
#   UPLOADS_DIR=/var/lib/ilmnet/uploads \
#   BACKUP_DIR=/var/backups/ilmnet \
#   ops/backup.sh
#
# What it writes into BACKUP_DIR (umask 077 — the dump contains account hashes):
#   <prefix>-db-<timestamp>.dump          pg_dump --format=custom (compressed, restorable per object)
#   <prefix>-uploads-<timestamp>.tar.gz   the uploads directory (custom thumbnails/covers)
#   <prefix>-manifest-<timestamp>.txt     row counts at backup time + file sizes + sha256
#
# Exit codes: 0 ok · 1 usage/config error · 2 a required tool is missing · 3 a step failed.
#
# NO new dependencies: this uses the PostgreSQL client tools (pg_dump, pg_restore, psql) and
# coreutils. The scripts are provider-agnostic — run them on the host, in a container or from a
# CI job. Scheduling and off-site copies are documented in docs/DEPLOYMENT.md § Backup en herstel.
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DATABASE_URL="${DATABASE_URL:-}"
UPLOADS_DIR="${UPLOADS_DIR:-$REPO_ROOT/server/uploads}"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
PREFIX="${BACKUP_PREFIX:-ilmnet}"

die() { echo "error: $*" >&2; exit "${2:-3}"; }
info() { echo "  $*"; }

# ── configuration ────────────────────────────────────────────────────────────
[[ -n "$DATABASE_URL" ]] || die "DATABASE_URL is required (postgresql://user:pass@host:5432/dbname)" 1

for tool in pg_dump pg_restore psql tar sha256sum date; do
  command -v "$tool" >/dev/null 2>&1 || die "required tool not found: $tool (PostgreSQL client tools + coreutils)" 2
done

[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || die "RETENTION_DAYS must be a whole number of days" 1

# Never print or store credentials: strip them from any URL we echo.
mask_url() {
  local url="$1"
  printf '%s' "$url" | sed -E 's#^([a-zA-Z][a-zA-Z0-9+.-]*://)[^@/]*@#\1***@#'
}

# Replace the database name in a connection URL (used to reach the maintenance database).
url_with_db() {
  local url="$1" db="$2"
  printf '%s' "$url" | sed -E "s#^(.*/)([^/?]+)(\?.*)?\$#\1${db}\3#"
}

# Prisma accepts URL parameters that the PostgreSQL client tools do not understand
# (schema, connection_limit, pool_timeout, …). Strip those — and only those — so one
# DATABASE_URL works for the app and for pg_dump/psql/pg_restore. Standard libpq
# parameters (sslmode, connect_timeout, …) are preserved.
libpq_url() {
  local url="$1" base pair key
  local -a pairs kept
  if [[ "$url" == *"?"* ]]; then
    base="${url%%\?*}"
    IFS='&' read -r -a pairs <<< "${url#*\?}"
    kept=()
    for pair in "${pairs[@]}"; do
      [[ -n "$pair" ]] || continue
      key="${pair%%=*}"
      case "$key" in
        schema|connection_limit|pool_timeout|pgbouncer|statement_cache_size|socket_timeout|relationMode) continue ;;
      esac
      kept+=("$pair")
    done
    local joined=""
    for pair in "${kept[@]:-}"; do
      [[ -n "$pair" ]] && joined+="${joined:+&}$pair"
    done
    if [[ -n "$joined" ]]; then printf '%s?%s' "$base" "$joined"; else printf '%s' "$base"; fi
  else
    printf '%s' "$url"
  fi
}

db_name_from_url() {
  printf '%s' "$1" | sed -E 's#^.*/([^/?]+)(\?.*)?$#\1#'
}

DB_MASKED="$(mask_url "$DATABASE_URL")"
DB_NAME="$(db_name_from_url "$DATABASE_URL")"
LIBPQ_URL="$(libpq_url "$DATABASE_URL")"  # for the client tools, without Prisma-only parameters

umask 077
mkdir -p "$BACKUP_DIR" || die "cannot create BACKUP_DIR: $BACKUP_DIR" 3

STAMP="$(date -u +%Y%m%d-%H%M%S)"
DUMP="$BACKUP_DIR/${PREFIX}-db-${STAMP}.dump"
UPLOADS_ARCHIVE="$BACKUP_DIR/${PREFIX}-uploads-${STAMP}.tar.gz"
MANIFEST="$BACKUP_DIR/${PREFIX}-manifest-${STAMP}.txt"

echo "ilmNet backup — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
info "database : $DB_MASKED"
info "uploads  : $UPLOADS_DIR"
info "target   : $BACKUP_DIR"

# ── 1. database ──────────────────────────────────────────────────────────────
info "dumping database …"
pg_dump --format=custom --no-owner --no-acl --file="$DUMP" "$LIBPQ_URL" \
  || { rm -f "$DUMP"; die "pg_dump failed for $DB_MASKED" 3; }

# Integrity: a dump that pg_restore cannot list is not a backup.
DUMP_ENTRIES="$(pg_restore --list "$DUMP" | grep -c '^[0-9]' || true)"
[[ "$DUMP_ENTRIES" -gt 0 ]] || die "dump has no restorable objects: $DUMP" 3
info "dump ok: $(stat -c%s "$DUMP") bytes, $DUMP_ENTRIES restorable object(s)"

# ── 2. uploads ───────────────────────────────────────────────────────────────
UPLOADS_FILES=0
if [[ -d "$UPLOADS_DIR" ]]; then
  info "archiving uploads …"
  tar -czf "$UPLOADS_ARCHIVE" -C "$UPLOADS_DIR" . || die "tar failed for $UPLOADS_DIR" 3
  UPLOADS_FILES="$(find "$UPLOADS_DIR" -type f ! -name '.gitkeep' | wc -l | tr -d ' ')"
  info "uploads ok: $(stat -c%s "$UPLOADS_ARCHIVE") bytes, $UPLOADS_FILES file(s)"
else
  info "uploads: directory $UPLOADS_DIR does not exist — nothing to archive (recorded in the manifest)"
  UPLOADS_ARCHIVE=""
fi

# ── 3. manifest + checksums ──────────────────────────────────────────────────
count_rows() {
  local table="$1"
  psql "$LIBPQ_URL" -tAc "SELECT count(*) FROM \"$table\"" 2>/dev/null | tr -d ' ' || echo "n/a"
}

{
  echo "# ilmNet backup manifest"
  echo "created_at_utc = $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "host           = $(hostname)"
  echo "database       = $DB_MASKED"
  echo "uploads_dir    = $UPLOADS_DIR"
  echo "retention_days = $RETENTION_DAYS"
  echo
  echo "# row counts at backup time (compare after a restore)"
  echo "contents=$(count_rows contents)"
  echo "scholars=$(count_rows scholars)"
  echo "subjects=$(count_rows subjects)"
  echo "content_scholars=$(count_rows content_scholars)"
  echo "content_subjects=$(count_rows content_subjects)"
  echo "import_jobs=$(count_rows import_jobs)"
  echo "admin_users=$(count_rows admin_users)"
  echo "admin_sessions=$(count_rows admin_sessions)"
  echo
  echo "# files"
  echo "dump=$(basename "$DUMP") size=$(stat -c%s "$DUMP") sha256=$(sha256sum "$DUMP" | cut -d' ' -f1)"
  if [[ -n "$UPLOADS_ARCHIVE" ]]; then
    echo "uploads=$(basename "$UPLOADS_ARCHIVE") size=$(stat -c%s "$UPLOADS_ARCHIVE") files=$UPLOADS_FILES sha256=$(sha256sum "$UPLOADS_ARCHIVE" | cut -d' ' -f1)"
  else
    echo "uploads=(none) files=0"
  fi
} > "$MANIFEST"

info "manifest: $(basename "$MANIFEST")"

# ── 4. retention ─────────────────────────────────────────────────────────────
if [[ "$RETENTION_DAYS" -gt 0 ]]; then
  removed="$(find "$BACKUP_DIR" -maxdepth 1 -type f \
      \( -name "${PREFIX}-db-*.dump" -o -name "${PREFIX}-uploads-*.tar.gz" -o -name "${PREFIX}-manifest-*.txt" \) \
      -mtime "+$RETENTION_DAYS" -print -delete | wc -l | tr -d ' ')"
  [[ "$removed" -gt 0 ]] && info "retention: removed $removed file(s) older than $RETENTION_DAYS day(s)"
fi

echo "backup complete."
echo "  verify now  : ops/restore-drill.sh          (restores this set into a throwaway database)"
echo "  restore docs: docs/DEPLOYMENT.md § Backup en herstel"
