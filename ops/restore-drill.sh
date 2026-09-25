#!/usr/bin/env bash
#
# ilmNet — restore drill: prove that a backup set really restores, without touching live data.
#
#   ops/restore-drill.sh                      # newest set in BACKUP_DIR
#   ops/restore-drill.sh --dump <file> [--uploads <file>]
#
# What it does:
#   1. picks a backup set (newest manifest in BACKUP_DIR, or the files you pass) **together with its
#      manifest** — the manifest is what the drill compares against, so without one there is nothing
#      to verify and the drill refuses to run instead of reporting a success it cannot prove;
#   2. restores the database into a THROWAWAY database (<DRILL_DATABASE>, default
#      ilmnet_restore_drill) through the real ops/restore.sh — so the documented procedure is
#      what gets tested, not a parallel code path;
#   3. extracts the uploads archive into a temporary directory (never the live UPLOADS_DIR);
#   4. compares the restored row counts against the counts recorded in the manifest, and the
#      restored uploads file count against the manifest — PASS/FAIL with numbers;
#   5. reports how the live database differs from the backup (informative: drift since the
#      backup is normal, that is what a backup is for).
#
# The manifest is looked up next to the dump first (that is how an off-site copy arrives), then in
# BACKUP_DIR. Exit code 3 is returned when a comparison failed **or** when not a single value could
# be compared, so "PASSED" always means "this many values matched after a real restore".
#
# Env: DATABASE_URL (live database, for step 5) · BACKUP_DIR · UPLOADS_DIR · DRILL_DATABASE.
# Exit codes: 0 drill passed · 1 usage/config error (including a missing manifest) · 2 a required tool
# is missing · 3 the drill failed or nothing was verified.
#
# NO new dependencies. The drill database is left in place for inspection; pass --drop-after to
# remove it at the end of a successful run.
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DATABASE_URL="${DATABASE_URL:-}"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
UPLOADS_DIR="${UPLOADS_DIR:-$REPO_ROOT/server/uploads}"
DRILL_DATABASE="${DRILL_DATABASE:-ilmnet_restore_drill}"
PREFIX="${BACKUP_PREFIX:-ilmnet}"
DUMP=""
UPLOADS_ARCHIVE=""
DROP_AFTER=0

die() { echo "error: $*" >&2; exit "${2:-3}"; }
info() { echo "  $*"; }

usage() { sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit "${1:-1}"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dump)            DUMP="${2:-}"; shift 2 ;;
    --uploads)         UPLOADS_ARCHIVE="${2:-}"; shift 2 ;;
    --database-url)    DATABASE_URL="${2:-}"; shift 2 ;;
    --backup-dir)      BACKUP_DIR="${2:-}"; shift 2 ;;
    --uploads-dir)     UPLOADS_DIR="${2:-}"; shift 2 ;;
    --drill-database)  DRILL_DATABASE="${2:-}"; shift 2 ;;
    --drop-after)      DROP_AFTER=1; shift ;;
    --help|-h)         usage 0 ;;
    *)                 echo "error: unknown argument: $1" >&2; usage 1 ;;
  esac
done

# ── 1. pick the backup set and its manifest ──────────────────────────────────
# Every backup set shares one timestamp: <prefix>-{db,uploads,manifest}-<stamp>.<ext>
MANIFEST=""
if [[ -z "$DUMP" ]]; then
  MANIFEST="$(find "$BACKUP_DIR" -maxdepth 1 -name "${PREFIX}-manifest-*.txt" -printf '%T@ %p\n' 2>/dev/null \
    | sort -rn | head -1 | cut -d' ' -f2-)"
  [[ -n "$MANIFEST" ]] || die "no backup set found in $BACKUP_DIR — run ops/backup.sh first" 1
  DUMP_NAME="$(sed -n 's/^dump=\([^ ]*\).*/\1/p' "$MANIFEST" | head -1)"
  [[ -n "$DUMP_NAME" ]] || die "manifest $MANIFEST does not name a dump" 3
  DUMP="$BACKUP_DIR/$DUMP_NAME"
  if [[ -z "$UPLOADS_ARCHIVE" ]]; then
    UPLOADS_NAME="$(sed -n 's/^uploads=\([^ ]*\).*/\1/p' "$MANIFEST" | head -1)"
    [[ -n "$UPLOADS_NAME" && "$UPLOADS_NAME" != "(none)" ]] && UPLOADS_ARCHIVE="$BACKUP_DIR/$UPLOADS_NAME"
  fi
  info "backup set : $MANIFEST"
else
  BASE="$(basename "$DUMP")"
  STAMP="${BASE#*-db-}"; STAMP="${STAMP%.dump}"
  # Next to the dump itself first: that is how an off-site copy arrives (the whole set is copied),
  # and requiring BACKUP_DIR was what made the drill skip every comparison silently.
  for candidate in "$(dirname "$DUMP")/${PREFIX}-manifest-${STAMP}.txt" "$BACKUP_DIR/${PREFIX}-manifest-${STAMP}.txt"; do
    if [[ -f "$candidate" ]]; then MANIFEST="$candidate"; break; fi
  done
  if [[ -z "$UPLOADS_ARCHIVE" ]]; then
    for candidate in "$(dirname "$DUMP")/${PREFIX}-uploads-${STAMP}.tar.gz" "$BACKUP_DIR/${PREFIX}-uploads-${STAMP}.tar.gz"; do
      if [[ -f "$candidate" ]]; then UPLOADS_ARCHIVE="$candidate"; break; fi
    done
  fi
fi

[[ -f "$DUMP" ]] || die "dump not found: $DUMP" 1
[[ -n "$MANIFEST" && -f "$MANIFEST" ]] || die "no manifest for $(basename "$DUMP") — looked next to the dump ($(dirname "$DUMP")/${PREFIX}-manifest-<stamp>.txt) and in $BACKUP_DIR. A drill compares the restore against the manifest, so without one it cannot verify anything and refuses to run (use ops/restore.sh for an unverified restore)." 1
[[ -n "$DATABASE_URL" ]] || die "DATABASE_URL is required — the drill creates the throwaway database on that server" 1

for tool in psql pg_restore tar; do
  command -v "$tool" >/dev/null 2>&1 || die "required tool not found: $tool (PostgreSQL client tools)" 2
done

[[ "$DRILL_DATABASE" != "postgres" && "$DRILL_DATABASE" != "template1" ]] \
  || die "DRILL_DATABASE must not be a maintenance database" 1

mask_url() { printf '%s' "$1" | sed -E 's#^([a-zA-Z][a-zA-Z0-9+.-]*://)[^@/]*@#\1***@#'; }
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

url_with_db() { printf '%s' "$1" | sed -E "s#^(.*/)([^/?]+)(\?.*)?\$#\1${2}\3#"; }

# ── 2. expected values from the manifest ─────────────────────────────────────
expected() { sed -n "s/^$1=\([0-9]*\).*/\1/p" "$MANIFEST" | head -1; return 0; }

echo "ilmNet restore drill — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
info "dump       : $DUMP"
info "manifest   : $MANIFEST"
info "drill db   : $DRILL_DATABASE"
info "live db    : $(mask_url "$DATABASE_URL")"

SOURCE_LIBPQ_URL="$(libpq_url "$DATABASE_URL")"
DRILL_URL="$(url_with_db "$SOURCE_LIBPQ_URL" "$DRILL_DATABASE")"
TMP_UPLOADS="$(mktemp -d)"
cleanup() { rm -rf "$TMP_UPLOADS"; }
trap cleanup EXIT

# ── 3. restore through the real procedure ────────────────────────────────────
echo
echo "── restore (ops/restore.sh, into the throwaway database) ──"
RESTORE_ARGS=(--dump "$DUMP" --database-url "$DRILL_URL" --recreate --yes)
if [[ -n "$UPLOADS_ARCHIVE" ]]; then
  RESTORE_ARGS+=(--uploads "$UPLOADS_ARCHIVE" --uploads-dir "$TMP_UPLOADS" --force)
fi
"$REPO_ROOT/ops/restore.sh" "${RESTORE_ARGS[@]}"

# ── 4. compare ───────────────────────────────────────────────────────────────
echo
echo "── verification against $(basename "$MANIFEST") ──"
FAILED=0
COMPARED=0
count_in() { psql "$2" -tAc "SELECT count(*) FROM \"$1\"" 2>/dev/null | tr -d ' ' || echo "n/a"; }

printf '  %-18s %10s %10s %10s   %s\n' "table" "manifest" "restored" "live" "verdict"
for table in contents scholars subjects content_scholars content_subjects import_jobs admin_users; do
  want="$(expected "$table")"
  got="$(count_in "$table" "$DRILL_URL")"
  live="$(count_in "$table" "$SOURCE_LIBPQ_URL")"
  if [[ -z "$want" ]]; then
    verdict="not in the manifest"
  else
    COMPARED=$((COMPARED + 1))
    if [[ "$want" == "$got" ]]; then verdict="PASS"; else verdict="FAIL (expected $want)"; FAILED=1; fi
  fi
  printf '  %-18s %10s %10s %10s   %s\n' "$table" "${want:-–}" "${got:-n/a}" "${live:-n/a}" "$verdict"
done

if [[ -n "$UPLOADS_ARCHIVE" ]]; then
  want_files="$(sed -n 's/^uploads=.* files=\([0-9]*\).*/\1/p' "$MANIFEST" | head -1 || true)"
  got_files="$(find "$TMP_UPLOADS" -type f ! -name '.gitkeep' | wc -l | tr -d ' ')"
  if [[ -z "$want_files" ]]; then
    printf '  %-18s %10s %10s %10s   %s\n' "uploads (files)" "–" "$got_files" "–" "not in the manifest"
  else
    COMPARED=$((COMPARED + 1))
    if [[ "$want_files" == "$got_files" ]]; then
      printf '  %-18s %10s %10s %10s   %s\n' "uploads (files)" "$want_files" "$got_files" "–" "PASS"
    else
      printf '  %-18s %10s %10s %10s   %s\n' "uploads (files)" "$want_files" "$got_files" "–" "FAIL"
      FAILED=1
    fi
  fi
  # Integrity per file: everything in the archive must match the live file byte for byte.
  same=0; differ=0; missing=0
  while IFS= read -r -d '' f; do
    rel="${f#"$TMP_UPLOADS"/}"
    live_file="$UPLOADS_DIR/$rel"
    if [[ ! -f "$live_file" ]]; then
      missing=$((missing + 1)); continue
    fi
    if [[ "$(sha256sum "$f" | cut -d' ' -f1)" == "$(sha256sum "$live_file" | cut -d' ' -f1)" ]]; then
      same=$((same + 1))
    else
      differ=$((differ + 1)); echo "      differs: $rel" >&2
    fi
  done < <(find "$TMP_UPLOADS" -type f ! -name '.gitkeep' -print0)
  if [[ "$differ" -gt 0 ]]; then
    printf '  %-18s %10s %10s %10s   %s\n' "uploads (sha256)" "–" "$differ" "–" "FAIL"
    FAILED=1
  elif [[ "$same" -gt 0 ]]; then
    COMPARED=$((COMPARED + 1))
    printf '  %-18s %10s %10s %10s   %s\n' "uploads (sha256)" "$same" "$same" "–" "PASS"
  elif [[ "$got_files" -eq 0 ]]; then
    printf '  %-18s %10s %10s %10s   %s\n' "uploads (sha256)" "0" "0" "–" "PASS (the set has no files)"
  else
    # Every archived file is gone from UPLOADS_DIR: the set still restores, but nothing could be
    # compared. Say so instead of printing a PASS that proves nothing.
    printf '  %-18s %10s %10s %10s   %s\n' "uploads (sha256)" "–" "0" "–" "not compared (all $got_files file(s) drifted)"
  fi
  if [[ "$missing" -gt 0 ]]; then info "$missing archived file(s) no longer exist in $UPLOADS_DIR (deleted since the backup — normal drift)"; fi
  info "uploads extracted into a temporary directory (the live $UPLOADS_DIR was not touched)"
fi

# Row-level sanity: the restored database must serve a real query, not just count rows.
top_title="$(psql "$DRILL_URL" -tAc "SELECT title FROM contents ORDER BY \"createdAt\" LIMIT 1" 2>/dev/null | head -1 || true)"
if [[ -n "$top_title" ]]; then
  info "sample restored row: ${top_title:0:70}"
else
  info "no content rows in the restored database (empty library is a valid state)"
fi

# ── 5. verdict ───────────────────────────────────────────────────────────────
# A drill that compared nothing is not a passed drill: both a failed comparison and an empty
# comparison must end in exit 3, so "PASSED" always carries a number.
VERDICT_OK=1
if [[ "$FAILED" -eq 1 || "$COMPARED" -eq 0 ]]; then VERDICT_OK=0; fi

if [[ "$DROP_AFTER" -eq 1 && "$VERDICT_OK" -eq 1 ]]; then
  psql "$(url_with_db "$SOURCE_LIBPQ_URL" postgres)" -q -c "DROP DATABASE IF EXISTS \"$DRILL_DATABASE\";" || true
  info "drill database dropped (--drop-after)"
else
  info "drill database kept for inspection: psql \"$(mask_url "$DRILL_URL")\" -c '\\dt'"
  info "drop it with: psql \"$(mask_url "$(url_with_db "$SOURCE_LIBPQ_URL" postgres)")\" -c 'DROP DATABASE $DRILL_DATABASE;'"
fi

echo
if [[ "$VERDICT_OK" -eq 1 ]]; then
  echo "drill PASSED — the backup set restored into an empty database and $COMPARED comparison(s) against $(basename "$MANIFEST") matched."
  exit 0
fi
if [[ "$FAILED" -eq 1 ]]; then
  echo "drill FAILED — see the verdict column above." >&2
  exit 3
fi
echo "drill FAILED — the restore ran, but not one value could be compared against $(basename "$MANIFEST"): the restore is unverified." >&2
exit 3
