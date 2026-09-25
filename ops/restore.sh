#!/usr/bin/env bash
#
# ilmNet — restore: put a backup set back (PostgreSQL dump, optionally the uploads archive).
#
#   # restore into a fresh database (dropped and recreated first)
#   ops/restore.sh --dump /var/backups/ilmnet/ilmnet-db-20260925-120000.dump \
#                  --database-url "postgresql://ilmnet:pass@dbhost:5432/ilmnet" \
#                  --uploads /var/backups/ilmnet/ilmnet-uploads-20260925-120000.tar.gz \
#                  --recreate --yes
#
#   # restore into an existing database (objects are dropped/replaced, --clean --if-exists)
#   ops/restore.sh --dump <file> --database-url <url> --yes
#
# Safety rules, by design:
#   * the target database must be named explicitly (--database-url / TARGET_DATABASE_URL) —
#     there is no implicit "restore over whatever DATABASE_URL points at";
#   * --recreate (DROP DATABASE) additionally requires --yes, and the maintenance database used
#     for the drop is derived from the same URL, so it can only ever touch that server;
#   * the uploads directory is never overwritten silently: a non-empty target needs --force;
#   * the dump is validated with `pg_restore --list` before anything is touched.
#
# Exit codes: 0 ok · 1 usage/config error · 2 a required tool is missing · 3 a step failed.
#
# NO new dependencies: PostgreSQL client tools + coreutils, same as ops/backup.sh.
# Step-by-step recovery guidance: docs/DEPLOYMENT.md § Backup en herstel.
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DUMP=""
UPLOADS_ARCHIVE=""
TARGET_DATABASE_URL="${TARGET_DATABASE_URL:-}"
UPLOADS_DIR="${UPLOADS_DIR:-$REPO_ROOT/server/uploads}"
RECREATE=0
FORCE=0
ASSUME_YES=0

die() { echo "error: $*" >&2; exit "${2:-3}"; }
info() { echo "  $*"; }

usage() {
  sed -n '2,26p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit "${1:-1}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dump)         DUMP="${2:-}"; shift 2 ;;
    --uploads)      UPLOADS_ARCHIVE="${2:-}"; shift 2 ;;
    --database-url) TARGET_DATABASE_URL="${2:-}"; shift 2 ;;
    --uploads-dir)  UPLOADS_DIR="${2:-}"; shift 2 ;;
    --recreate)     RECREATE=1; shift ;;
    --force)        FORCE=1; shift ;;
    --yes|-y)       ASSUME_YES=1; shift ;;
    --help|-h)      usage 0 ;;
    *)              echo "error: unknown argument: $1" >&2; usage 1 ;;
  esac
done

[[ -n "$DUMP" ]] || { echo "error: --dump is required" >&2; usage 1; }
[[ -n "$TARGET_DATABASE_URL" ]] || die "--database-url (or TARGET_DATABASE_URL) is required — the target must be explicit" 1
[[ -f "$DUMP" ]] || die "dump not found: $DUMP" 1
[[ -n "$UPLOADS_ARCHIVE" && ! -f "$UPLOADS_ARCHIVE" ]] && die "uploads archive not found: $UPLOADS_ARCHIVE" 1

for tool in pg_restore psql tar; do
  command -v "$tool" >/dev/null 2>&1 || die "required tool not found: $tool (PostgreSQL client tools)" 2
done

mask_url() { printf '%s' "$1" | sed -E 's#^([a-zA-Z][a-zA-Z0-9+.-]*://)[^@/]*@#\1***@#'; }
url_with_db() { printf '%s' "$1" | sed -E "s#^(.*/)([^/?]+)(\?.*)?\$#\1${2}\3#"; }
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

db_name_from_url() { printf '%s' "$1" | sed -E 's#^.*/([^/?]+)(\?.*)?$#\1#'; }

DB_NAME="$(db_name_from_url "$TARGET_DATABASE_URL")"
TARGET_LIBPQ_URL="$(libpq_url "$TARGET_DATABASE_URL")"  # client tools reject Prisma-only parameters
[[ -n "$DB_NAME" && "$DB_NAME" != "postgres" && "$DB_NAME" != "template1" ]] \
  || die "refusing to restore into the maintenance database (\"$DB_NAME\")" 1

# Validate the dump before touching anything.
pg_restore --list "$DUMP" >/dev/null 2>&1 || die "not a readable pg_dump custom-format archive: $DUMP" 1
DUMP_ENTRIES="$(pg_restore --list "$DUMP" | grep -c '^[0-9]' || true)"
[[ "$DUMP_ENTRIES" -gt 0 ]] || die "dump contains no restorable objects: $DUMP" 1

if [[ -n "$UPLOADS_ARCHIVE" ]]; then
  tar -tzf "$UPLOADS_ARCHIVE" >/dev/null 2>&1 || die "not a readable tar.gz archive: $UPLOADS_ARCHIVE" 1
fi

echo "ilmNet restore — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
info "dump      : $DUMP ($DUMP_ENTRIES object(s), $(stat -c%s "$DUMP") bytes)"
info "target db : $(mask_url "$TARGET_DATABASE_URL")"
info "mode      : $([[ "$RECREATE" -eq 1 ]] && echo 'DROP + CREATE the target database' || echo 'restore into the existing database (--clean --if-exists)')"
[[ -n "$UPLOADS_ARCHIVE" ]] && info "uploads   : $UPLOADS_ARCHIVE → $UPLOADS_DIR"

if [[ "$ASSUME_YES" -ne 1 ]]; then
  printf 'This replaces the contents of "%s". Continue? [y/N] ' "$DB_NAME"
  read -r answer
  [[ "$answer" =~ ^[yY]$ ]] || die "aborted — nothing was changed" 1
fi

# ── 1. target database ───────────────────────────────────────────────────────
if [[ "$RECREATE" -eq 1 ]]; then
  [[ "$ASSUME_YES" -eq 1 ]] || die "--recreate requires --yes (it drops the database)" 1
  MAINTENANCE_URL="$(url_with_db "$TARGET_LIBPQ_URL" postgres)"
  info "terminating connections and dropping \"$DB_NAME\" …"
  psql "$MAINTENANCE_URL" -v ON_ERROR_STOP=1 -q -tA -c \
    "SELECT count(pg_terminate_backend(pid)) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" \
    >/dev/null || die "could not terminate connections to $DB_NAME" 3
  psql "$MAINTENANCE_URL" -v ON_ERROR_STOP=1 -q -c "DROP DATABASE IF EXISTS \"$DB_NAME\";" \
    || die "could not drop $DB_NAME" 3
  psql "$MAINTENANCE_URL" -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE \"$DB_NAME\";" \
    || die "could not create $DB_NAME" 3
  info "database recreated (empty)"
fi

# ── 2. data ──────────────────────────────────────────────────────────────────
RESTORE_LOG="$(mktemp)"
trap 'rm -f "$RESTORE_LOG"' EXIT
info "restoring data …"
set +e
if [[ "$RECREATE" -eq 1 ]]; then
  pg_restore --no-owner --no-acl --dbname="$TARGET_LIBPQ_URL" "$DUMP" >"$RESTORE_LOG" 2>&1
else
  pg_restore --clean --if-exists --no-owner --no-acl --dbname="$TARGET_LIBPQ_URL" "$DUMP" >"$RESTORE_LOG" 2>&1
fi
RESTORE_STATUS=$?
set -e
# pg_restore exits 1 for warnings (e.g. "does not exist, skipping" during --clean); real errors count.
REAL_ERRORS="$(grep -c -E 'error:|FATAL:' "$RESTORE_LOG" || true)"
if [[ "$RESTORE_STATUS" -ne 0 && "$REAL_ERRORS" -gt 0 ]]; then
  tail -20 "$RESTORE_LOG" | sed 's/^/    /'
  die "pg_restore reported $REAL_ERRORS error(s) — see above" 3
fi
info "data restored (pg_restore exit $RESTORE_STATUS, $REAL_ERRORS error line(s))"

# ── 3. uploads ───────────────────────────────────────────────────────────────
if [[ -n "$UPLOADS_ARCHIVE" ]]; then
  EXISTING="$(find "$UPLOADS_DIR" -type f ! -name '.gitkeep' 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "$EXISTING" -gt 0 && "$FORCE" -ne 1 ]]; then
    die "uploads target $UPLOADS_DIR already holds $EXISTING file(s) — pass --force to overwrite" 1
  fi
  mkdir -p "$UPLOADS_DIR"
  tar -xzf "$UPLOADS_ARCHIVE" -C "$UPLOADS_DIR" || die "could not extract $UPLOADS_ARCHIVE" 3
  info "uploads restored into $UPLOADS_DIR ($(find "$UPLOADS_DIR" -type f ! -name '.gitkeep' | wc -l | tr -d ' ') file(s))"
fi

# ── 4. verification ──────────────────────────────────────────────────────────
count_rows() { psql "$TARGET_LIBPQ_URL" -tAc "SELECT count(*) FROM \"$1\"" 2>/dev/null | tr -d ' ' || echo "n/a"; }

echo "restore complete. Row counts in \"$DB_NAME\":"
for table in contents scholars subjects content_scholars content_subjects import_jobs admin_users; do
  printf '  %-18s %s\n' "$table" "$(count_rows "$table")"
done
echo
echo "  next: if the dump predates a migration, run 'npx prisma migrate deploy' (server/) against"
echo "        this database, then restart the API and check GET /api/health."
echo "        uploads are only served if UPLOADS_DIR points at the restored directory."
