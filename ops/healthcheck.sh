#!/usr/bin/env bash
#
# ilmNet — watchdog: is this deployment actually alive and is it still backed up?
#
#   ops/healthcheck.sh                                  # local API on :3001, defaults from env
#   BASE_URL=https://ilmnet.example ops/healthcheck.sh   # a real deployment
#   ops/healthcheck.sh --quiet                           # cron/timer use: only failures are printed
#
# What it checks (each one is a fact, not a guess):
#   1. GET /api/health   → HTTP 200 and status "ok"      (deep check: database + upload storage)
#   2. GET /api/ready    → HTTP 200 and status "ready"   (the probe a load balancer would use)
#   3. uploads directory → exists and is writable        (only when UPLOADS_DIR is set)
#   4. newest backup set → younger than BACKUP_MAX_AGE_HOURS  (a silently failing timer is invisible
#      without this; a backup you have not received is not a backup)
#   5. free disk space   → above DISK_CRIT/DISK_WARN percent on DISK_PATHS
#   6. optional database → `SELECT 1` + reported size    (only when DATABASE_URL is set)
#   7. release identity   → the version/commit /api/health reports, in the log and in the alert, so an
#      incident says which release was live
#
# `--quiet` (for the timer) prints nothing on a healthy run, but a failing run always writes its FAIL
# lines, the release and the summary to stderr — the journal must show why the watchdog exited 1. A
# warning on its own stays quiet under --quiet (with --strict, which makes a warning a failure, it is
# printed as well) so a timer does not repeat the same warning every five minutes.
#
# Env: BASE_URL · HEALTH_URL · READY_URL · UPLOADS_DIR · BACKUP_DIR · BACKUP_PREFIX ·
#      BACKUP_MAX_AGE_HOURS (default 30, 0 = skip) · DISK_PATHS (default: BACKUP_DIR and UPLOADS_DIR) ·
#      DISK_WARN_PERCENT (85) · DISK_CRIT_PERCENT (95) · DATABASE_URL · ALERT_WEBHOOK_URL ·
#      ALERT_MAIL_TO · ALERT_SERVICE_NAME
#
# Exit codes: 0 everything OK (warnings allowed) · 1 at least one check failed · 2 a required tool is
# missing · 3 usage error. With --strict a WARN also fails, for hosts that want to act on early
# signals. Alerts are sent through ops/alert.sh when ALERT_WEBHOOK_URL or ALERT_MAIL_TO is set.
#
# NO new dependencies: curl, df, find, date and (optionally) psql — tools every host already has.
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BASE_URL="${BASE_URL:-http://127.0.0.1:3001}"
HEALTH_URL="${HEALTH_URL:-$BASE_URL/api/health}"
READY_URL="${READY_URL:-$BASE_URL/api/ready}"
UPLOADS_DIR="${UPLOADS_DIR:-}"
BACKUP_DIR="${BACKUP_DIR:-}"
PREFIX="${BACKUP_PREFIX:-ilmnet}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-30}"
DISK_WARN_PERCENT="${DISK_WARN_PERCENT:-85}"
DISK_CRIT_PERCENT="${DISK_CRIT_PERCENT:-95}"
DATABASE_URL="${DATABASE_URL:-}"
QUIET=0
STRICT=0
CURL_TIMEOUT="${CURL_TIMEOUT:-10}"

FAILED=0
WARNED=0
declare -a REPORT=()

die() { echo "error: $*" >&2; exit "${2:-3}"; }
usage() { sed -n '2,32p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit "${1:-3}"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --quiet)  QUIET=1; shift ;;
    --strict) STRICT=1; shift ;;
    --base)   BASE_URL="${2:-}"; HEALTH_URL="$BASE_URL/api/health"; READY_URL="$BASE_URL/api/ready"; shift 2 ;;
    -h|--help) usage 0 ;;
    *) die "unknown option: $1 (try --help)" 3 ;;
  esac
done

for tool in curl df find date; do
  command -v "$tool" >/dev/null 2>&1 || die "required tool not found: $tool" 2
done
[[ "$BACKUP_MAX_AGE_HOURS" =~ ^[0-9]+$ ]] || die "BACKUP_MAX_AGE_HOURS must be a whole number of hours" 3
[[ "$DISK_WARN_PERCENT" =~ ^[0-9]+$ && "$DISK_CRIT_PERCENT" =~ ^[0-9]+$ ]] || die "disk percentages must be whole numbers" 3

ok()   { REPORT+=("OK   $*"); }
warn() { REPORT+=("WARN $*"); WARNED=1; }
bad()  { REPORT+=("FAIL $*"); FAILED=1; }
# --quiet keeps a healthy run silent (cron/timer mail only when something is wrong) but must never
# swallow the reason a run failed: the failing lines, the release and the summary still go to stderr, so
# `journalctl -u ilmnet-healthcheck` shows them. say() must also never return non-zero in quiet mode —
# it used to end the script through `set -e` before a single line was printed.
say()  { if [[ "$QUIET" -eq 1 ]]; then return 0; fi; printf '  %s\n' "$*"; }

# Read one flat JSON string field without pulling in a JSON parser: the API answers compact JSON,
# and we only ever need a handful of fixed keys.
json_field() { printf '%s' "$1" | grep -o -m1 "\"$2\":\"[^\"]*\"" | cut -d'"' -f4 || true; }

# ── 1 + 2. HTTP checks ───────────────────────────────────────────────────────
# The response body is handed back through the variable named by the fifth argument (`printf -v`), so a
# caller can read it. The release used to come from a temp file this function deleted before anything
# read it, which is why the watchdog could never report which release was live.
check_http() {
  local label="$1" url="$2" expect_field="$3" expect_value="$4" out_var="${5:-}"
  local tmp body code json
  tmp="$(mktemp)"
  body="$(curl -sS --max-time "$CURL_TIMEOUT" -o "$tmp" -w '%{http_code}' "$url" 2>/dev/null || true)"
  code="${body:-000}"
  json="$(cat "$tmp" 2>/dev/null || true)"
  rm -f "$tmp"
  if [[ -n "$out_var" ]]; then printf -v "$out_var" '%s' "$json"; fi

  if [[ "$code" != "200" ]]; then
    local detail=""
    [[ "$code" == "503" ]] && detail=" (the API is up but reports degraded/unready — see its JSON body)"
    bad "$label $url → HTTP $code$detail"
    return 0
  fi
  if [[ -n "$expect_field" ]]; then
    local got
    got="$(json_field "$json" "$expect_field")"
    if [[ "$got" != "$expect_value" ]]; then
      bad "$label $url → HTTP 200 but $expect_field=\"$got\" (expected \"$expect_value\")"
      return 0
    fi
  fi
  ok "$label $url → HTTP 200${expect_field:+ · $expect_field=$expect_value}"
  return 0
}

HEALTH_JSON=""
check_http "health" "$HEALTH_URL" "status" "ok" HEALTH_JSON
check_http "ready " "$READY_URL" "status" "ready"

# Report the release the API claims to run (in the log and in the alert message). Empty when the health
# check itself failed — the release is then simply unknown, not guessed.
RELEASE=""
ENVIRONMENT=""
if [[ -n "$HEALTH_JSON" ]]; then
  RELEASE="$(json_field "$HEALTH_JSON" version)"
  COMMIT="$(json_field "$HEALTH_JSON" commit)"
  if [[ -n "$COMMIT" ]]; then RELEASE="$RELEASE ($COMMIT)"; fi
  # Environment rule (docs/ENVIRONMENTS.md): an incident report must say *which* environment it is
  # about, so the watchdog and its alert carry it next to the release. Empty when the health payload
  # does not report one — then it is unknown, not guessed.
  ENVIRONMENT="$(json_field "$HEALTH_JSON" environment)"
fi
if [[ -n "$RELEASE" ]]; then ok "release reported by /api/health: $RELEASE"; fi
if [[ -n "$ENVIRONMENT" ]]; then ok "environment reported by /api/health: $ENVIRONMENT"; fi

# ── 3. uploads directory ────────────────────────────────────────────────────
if [[ -n "$UPLOADS_DIR" ]]; then
  if [[ ! -d "$UPLOADS_DIR" ]]; then
    bad "uploads directory does not exist: $UPLOADS_DIR"
  elif [[ ! -w "$UPLOADS_DIR" ]]; then
    bad "uploads directory is not writable: $UPLOADS_DIR"
  else
    probe="$UPLOADS_DIR/.healthcheck-$$"
    if printf 'ilmnet healthcheck %s\n' "$(date -Is)" > "$probe" 2>/dev/null; then
      rm -f "$probe"
      ok "uploads directory exists and is writable ($UPLOADS_DIR)"
    else
      bad "uploads directory is not writable (write test failed): $UPLOADS_DIR"
    fi
  fi
fi

# ── 4. backup freshness ─────────────────────────────────────────────────────
if [[ "$BACKUP_MAX_AGE_HOURS" -gt 0 ]]; then
  if [[ -z "$BACKUP_DIR" ]]; then
    warn "BACKUP_DIR is not set — backup freshness was not checked (set it to make a silent backup failure visible)"
  elif [[ ! -d "$BACKUP_DIR" ]]; then
    bad "BACKUP_DIR does not exist: $BACKUP_DIR (no backup was ever written there)"
  else
    newest="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "${PREFIX}-manifest-*.txt" -printf '%T@ %p\n' 2>/dev/null | sort -nr | awk 'NR==1 {sub(/^[^ ]+ /, ""); print}' || true)"
    if [[ -z "$newest" ]]; then
      bad "no backup set found in $BACKUP_DIR (${PREFIX}-manifest-*.txt) — the timer has never run or writes elsewhere"
    else
      age_seconds=$(( $(date +%s) - $(stat -c %Y "$newest") ))
      age_hours=$(( age_seconds / 3600 ))
      if [[ "$age_hours" -gt "$BACKUP_MAX_AGE_HOURS" ]]; then
        bad "newest backup is ${age_hours}h old (limit ${BACKUP_MAX_AGE_HOURS}h): $(basename "$newest")"
      else
        ok "newest backup is ${age_hours}h old ($(basename "$newest"))"
      fi
    fi
  fi
fi

# ── 5. disk space ───────────────────────────────────────────────────────────
INCLUDE_DB_PATH=0
# Which filesystems to watch: DISK_PATHS when set (space separated), otherwise the backup volume and
# the uploads volume. Built as an array on purpose — `${VAR:-"$A $B"}` expands to a *single* word, so
# the paths were silently skipped until this was fixed.
DISK_LIST=()
if [[ -n "${DISK_PATHS:-}" ]]; then
  read -r -a DISK_LIST <<< "$DISK_PATHS"
else
  [[ -n "$BACKUP_DIR" ]] && DISK_LIST+=("$BACKUP_DIR")
  [[ -n "$UPLOADS_DIR" ]] && DISK_LIST+=("$UPLOADS_DIR")
fi
DISK_TARGETS=0
for dir in "${DISK_LIST[@]}"; do
  [[ -n "$dir" && -d "$dir" ]] || continue
  DISK_TARGETS=$((DISK_TARGETS + 1))
  use="$(df -P "$dir" | awk 'NR==2 {gsub("%","",$5); print $5}')"
  avail="$(df -Ph "$dir" | awk 'NR==2 {print $4}')"
  mount="$(df -P "$dir" | awk 'NR==2 {print $6}')"
  [[ "$use" =~ ^[0-9]+$ ]] || { warn "could not read disk usage for $dir"; continue; }
  if [[ "$use" -ge "$DISK_CRIT_PERCENT" ]]; then
    bad "disk ${use}% full on $mount ($dir, ${avail} free)"
  elif [[ "$use" -ge "$DISK_WARN_PERCENT" ]]; then
    warn "disk ${use}% full on $mount ($dir, ${avail} free)"
  else
    ok "disk ${use}% full on $mount ($dir, ${avail} free)"
  fi
done
if [[ "$DISK_TARGETS" -eq 0 ]]; then
  warn "no existing disk paths to check (set DISK_PATHS, BACKUP_DIR or UPLOADS_DIR)"
fi

# ── 6. optional database check ──────────────────────────────────────────────
if [[ -n "$DATABASE_URL" ]]; then
  if ! command -v psql >/dev/null 2>&1; then
    warn "DATABASE_URL is set but psql is not installed — skipped the database check"
  else
    # Reuse the backup script's URL handling: Prisma-only parameters (?schema=, &connection_limit=)
    # are stripped, standard libpq ones (sslmode, …) are kept. Never echo the URL itself.
    LIBPQ_URL="$(DATABASE_URL="$DATABASE_URL" bash -c 'set -Eeuo pipefail; src="$DATABASE_URL"; base="${src%%\?*}"; q="${src#"$base"}"; out=""; if [[ -n "$q" ]]; then while IFS= read -r pair; do k="${pair%%=*}"; case "$k" in schema|connection_limit|pool_timeout|socket_timeout) ;; *) out="${out}${out:+&}${pair}" ;; esac; done < <(printf "%s" "${q#\?}" | tr "&" "\n"); fi; printf "%s" "$base${out:+?$out}"')"
    if psql "$LIBPQ_URL" -tAc 'SELECT 1' >/dev/null 2>&1; then
      db_size="$(psql "$LIBPQ_URL" -tAc "SELECT pg_size_pretty(pg_database_size(current_database()))" 2>/dev/null | tr -d ' ' || true)"
      ok "database answers SELECT 1${db_size:+ (size ${db_size})}"
      INCLUDE_DB_PATH=1
    else
      bad "database does not answer SELECT 1 (DATABASE_URL set)"
    fi
  fi
fi

# ── report + alert ──────────────────────────────────────────────────────────
if [[ "$QUIET" -eq 0 ]]; then
  printf '  ilmNet watchdog — %s — %s\n' "$(date -Is)" "${BASE_URL}"
  for line in "${REPORT[@]}"; do say "$line"; done
elif [[ "$FAILED" -eq 1 || ( "$STRICT" -eq 1 && "$WARNED" -eq 1 ) ]]; then
  # A failing run leaves evidence in the journal even under --quiet, because the systemd unit starts
  # this script with --quiet and a silent failure would otherwise be invisible without an alert channel.
  # A WARN alone stays quiet (except with --strict, which turns it into a failure) so a timer does not
  # fill the journal with the same warning every five minutes.
  printf 'ilmNet watchdog — %s — %s\n' "$(date -Is)" "${BASE_URL}" >&2
  for line in "${REPORT[@]}"; do
    if [[ "$line" == FAIL* ]]; then printf '  %s\n' "$line" >&2
    elif [[ "$STRICT" -eq 1 && "$line" == WARN* ]]; then printf '  %s\n' "$line" >&2; fi
  done
  if [[ -n "$RELEASE" ]]; then printf '  release: %s\n' "$RELEASE" >&2; fi
  if [[ -n "$ENVIRONMENT" ]]; then printf '  environment: %s\n' "$ENVIRONMENT" >&2; fi
fi

summary=""
if [[ "$FAILED" -eq 1 ]]; then
  summary="FAIL"
elif [[ "$WARNED" -eq 1 ]]; then
  summary="WARN"
else
  summary="OK"
fi

if [[ "$summary" != "OK" ]]; then
  if [[ -n "${ALERT_WEBHOOK_URL:-}" || -n "${ALERT_MAIL_TO:-}" ]]; then
    body="$(printf '%s\n' "${REPORT[@]}")"
    severity="warning"; if [[ "$FAILED" -eq 1 ]]; then severity="critical"; fi
    "$SELF_DIR/alert.sh" --subject "ilmNet healthcheck $summary on $(hostname)" \
      --body "$body${RELEASE:+$'\n'release: $RELEASE}${ENVIRONMENT:+$'\n'environment: $ENVIRONMENT}" --severity "$severity" || true
  else
    # Say this out loud even in quiet mode: it is the difference between "somebody was told" and
    # "this failure exists only in a journal nobody reads".
    no_channel="(no alert channel configured: set ALERT_WEBHOOK_URL or ALERT_MAIL_TO — the lines above are the only copy)"
    if [[ "$QUIET" -eq 1 ]]; then printf '  %s\n' "$no_channel" >&2; else printf '  %s\n' "$no_channel"; fi
  fi
fi

if [[ "$QUIET" -eq 1 ]]; then
  if [[ "$FAILED" -eq 1 || ( "$STRICT" -eq 1 && "$WARNED" -eq 1 ) ]]; then
    printf '  result: %s (%s checks)\n' "$summary" "${#REPORT[@]}" >&2
  fi
else
  say "result: $summary (${#REPORT[@]} checks)"
fi
if [[ "$FAILED" -eq 1 ]]; then
  exit 1
fi
if [[ "$STRICT" -eq 1 && "$WARNED" -eq 1 ]]; then
  exit 1
fi
exit 0
