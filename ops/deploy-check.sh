#!/usr/bin/env bash
#
# ilmNet — deploy check: prove a deployment (or a rollback) is what it should be.
#
#   ops/deploy-check.sh --base https://ilmnet.example
#   ops/deploy-check.sh --base https://ilmnet.example --expect-commit a1b2c3d
#   BASE_URL=http://127.0.0.1:3001 ops/deploy-check.sh
#
# Run this right after `systemctl restart ilmnet` / `docker compose up -d --build` — and again after a
# rollback. It answers the questions an operator would otherwise answer by hand with five curl calls:
#
#   1. /api/ready    → 200 + status ready (the API talks to the database)
#   2. /api/health   → 200 + status ok, and prints the release it reports (version + commit)
#   3. /             → 200 and the app shell is really in the response
#   4. /lectures     → 200 (deep link: the SPA fallback works, a refresh on a subpage survives)
#   5. /robots.txt   → 200 + Disallow: /admin
#   6. /sitemap.xml  → 200 + XML, and at least one <loc> on the base origin
#   7. /brand/favicon/favicon-32.png → 200 with an image content type  (Fase 6.0: the official
#      IlmNet icon set; the package ships no .ico, so the old check on /favicon.ico was replaced)
#   8. /admin        → 200 HTML (the CMS gate answers; signing in is the operator's step)
#   9. /<random>.png → 404 (a missing *file* is not answered with the app shell and HTTP 200)
#  10. gzip          → / sends `content-encoding: gzip` when the client accepts it (Fase 5.4/5.5)
#  11. --expect-commit → the commit reported by /api/health starts with the expected value
#
# Env: BASE_URL (default http://127.0.0.1:3001) · CURL_TIMEOUT (10) · EXPECT_COMMIT.
# Exit codes: 0 all checks passed · 1 a check failed · 2 a required tool is missing · 3 usage error.
#
# NO new dependencies: curl and coreutils.
set -Eeuo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3001}"
CURL_TIMEOUT="${CURL_TIMEOUT:-10}"
EXPECT_COMMIT="${EXPECT_COMMIT:-}"

PASSED=0
FAILED=0
WARNED=0
EXPECT_SITEMAP_ORIGIN="${EXPECT_SITEMAP_ORIGIN:-}"
declare -a REPORT=()

die() { echo "error: $*" >&2; exit "${2:-3}"; }
usage() { sed -n '2,26p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit "${1:-3}"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base)          BASE_URL="${2:-}"; shift 2 ;;
    --expect-commit) EXPECT_COMMIT="${2:-}"; shift 2 ;;
    --expect-sitemap-origin) EXPECT_SITEMAP_ORIGIN="${2%/}"; shift 2 ;;
    -h|--help)       usage 0 ;;
    *) die "unknown option: $1 (try --help)" 3 ;;
  esac
done

command -v curl >/dev/null 2>&1 || die "required tool not found: curl" 2
BASE_URL="${BASE_URL%/}"

pass() { REPORT+=("PASS $*"); PASSED=$((PASSED + 1)); }
fail() { REPORT+=("FAIL $*"); FAILED=$((FAILED + 1)); }
warn() { REPORT+=("WARN $*"); WARNED=$((WARNED + 1)); }

# One request with headers + body captured together. The base URL never contains credentials.
BODY_FILE="$(mktemp -t ilmnet-deploycheck.XXXXXX)"
cleanup() { rm -f "$BODY_FILE"; }
trap cleanup EXIT

fetch() {
  local url="$1" accept="$2"
  curl -sS --max-time "$CURL_TIMEOUT" -D - -o "$BODY_FILE" -H "Accept-Encoding: $accept" "$url" 2>/dev/null || true
  printf '\n---BODY---\n'
  # Binary bodies (icons, archives) are only ever inspected through their headers; stripping NUL
  # bytes keeps bash from warning about "ignored null byte in input" when a body slips through.
  tr -d '\000' < "$BODY_FILE" 2>/dev/null || true
}

# Headers only: for endpoints whose body is binary or irrelevant here.
fetch_head() {
  local url="$1" accept="$2"
  curl -sS --max-time "$CURL_TIMEOUT" -D - -o "$BODY_FILE" -H "Accept-Encoding: $accept" "$url" 2>/dev/null || true
}

# `awk` reads to EOF on purpose: a `| head -1` after a producer stops it early, and with
# `set -o pipefail` that SIGPIPE becomes exit 141 (measured while testing this script).
status_of() { printf '%s' "$1" | awk 'NR==1 {print $2}'; }
header_of() { printf '%s' "$1" | grep -i -m1 "^$2:" | tr -d '\r' | cut -d' ' -f2- || true; }

# ── 1 + 2. readiness and deep health ────────────────────────────────────────
RESP="$(fetch "$BASE_URL/api/ready" identity)"; CODE="$(status_of "$RESP")"; BODY="$(printf '%s' "$RESP" | sed -n '/---BODY---/,$p')"
if [[ "$CODE" == "200" ]] && [[ "$BODY" == *'"status":"ready"'* ]]; then
  pass "/api/ready → 200 ready (the API reaches the database)"
else
  fail "/api/ready → HTTP $CODE $(printf '%s' "$BODY" | head -c 160)"
fi

RESP="$(fetch "$BASE_URL/api/health" identity)"; CODE="$(status_of "$RESP")"; BODY="$(printf '%s' "$RESP" | sed -n '/---BODY---/,$p')"
RELEASE_VERSION="$(printf '%s' "$BODY" | grep -o -m1 '"version":"[^"]*"' | cut -d'"' -f4 || true)"
RELEASE_COMMIT="$(printf '%s' "$BODY" | grep -o -m1 '"commit":"[^"]*"' | cut -d'"' -f4 || true)"
RELEASE_LABEL="${RELEASE_VERSION:-unknown}"
[[ -n "$RELEASE_COMMIT" ]] && RELEASE_LABEL="$RELEASE_LABEL (commit ${RELEASE_COMMIT:0:7})" || RELEASE_LABEL="$RELEASE_LABEL (no commit reported — set GIT_COMMIT on the host to make deploys verifiable)"
if [[ "$CODE" == "200" ]] && [[ "$BODY" == *'"status":"ok"'* ]]; then
  pass "/api/health → 200 ok · release $RELEASE_LABEL"
else
  fail "/api/health → HTTP $CODE $(printf '%s' "$BODY" | head -c 160)"
fi

if [[ -n "$EXPECT_COMMIT" ]]; then
  if [[ "$RELEASE_COMMIT" == "$EXPECT_COMMIT"* ]]; then
    pass "deployed commit matches --expect-commit ${EXPECT_COMMIT}"
  else
    fail "deployed commit is \"${RELEASE_COMMIT:-none}\" but ${EXPECT_COMMIT} was expected (wrong release or GIT_COMMIT not set on the host)"
  fi
fi

# ── 3. the app shell ────────────────────────────────────────────────────────
RESP="$(fetch "$BASE_URL/" identity)"; CODE="$(status_of "$RESP")"; BODY="$(printf '%s' "$RESP" | sed -n '/---BODY---/,$p')"
if [[ "$CODE" == "200" ]] && [[ "$BODY" == *'<div id="root"'* ]]; then
  pass "/ → 200 with the app shell"
else
  fail "/ → HTTP $CODE without the app shell (frontend build missing on the host?)"
fi

# ── 4. deep link (SPA fallback) ─────────────────────────────────────────────
RESP="$(fetch "$BASE_URL/lectures" identity)"; CODE="$(status_of "$RESP")"; BODY="$(printf '%s' "$RESP" | sed -n '/---BODY---/,$p')"
if [[ "$CODE" == "200" ]] && [[ "$BODY" == *'<div id="root"'* ]]; then
  pass "/lectures → 200 through the SPA fallback (a refresh on a subpage works)"
else
  fail "/lectures → HTTP $CODE (deep links broken — check the proxy and SERVE_FRONTEND)"
fi

# ── 5. robots.txt ───────────────────────────────────────────────────────────
RESP="$(fetch "$BASE_URL/robots.txt" identity)"; CODE="$(status_of "$RESP")"; BODY="$(printf '%s' "$RESP" | sed -n '/---BODY---/,$p')"
if [[ "$CODE" == "200" ]] && [[ "$BODY" == *"Disallow: /admin"* ]]; then
  pass "/robots.txt → 200 with the CMS disallowed"
else
  fail "/robots.txt → HTTP $CODE (expected the script route to answer, not the SPA fallback)"
fi

# ── 6. sitemap.xml ──────────────────────────────────────────────────────────
RESP="$(fetch "$BASE_URL/sitemap.xml" identity)"; CODE="$(status_of "$RESP")"; BODY="$(printf '%s' "$RESP" | sed -n '/---BODY---/,$p')"
if [[ "$CODE" == "200" ]] && [[ "$BODY" == *"<urlset"* ]] && [[ "$BODY" == *"<loc>"* ]]; then
  # The sitemap is built from PUBLIC_ORIGIN (Fase 5.5), so its origin is judged on its own: one origin
  # for every <loc>, and — in production — the same one you are testing.
  SITEMAP_ORIGIN="$(printf '%s' "$BODY" | grep -o -m1 '<loc>[^<]*</loc>' | sed -E 's#<loc>(https?://[^/]+)/.*#\1#' || true)"
  LOC_COUNT="$(printf '%s' "$BODY" | grep -c '<loc>' || true)"
  # `|| true`: `grep -v` exits 1 when every line matched (the normal case here), and with `pipefail`
  # that would fail the assignment and — because bash applies errexit to assignments — kill the script.
  OTHER_ORIGINS="$(printf '%s' "$BODY" | grep -o '<loc>[^<]*</loc>' | sed -E 's#<loc>(https?://[^/]+)/.*#\1#' | sort -u | grep -v -x -F "${SITEMAP_ORIGIN:-none}" | wc -l | tr -d ' ' || true)"
  if [[ "${OTHER_ORIGINS:-0}" != "0" ]]; then
    fail "/sitemap.xml mixes origins (${LOC_COUNT} <loc> entries, first ${SITEMAP_ORIGIN:-none}) — PUBLIC_ORIGIN should produce exactly one"
  elif [[ -n "${EXPECT_SITEMAP_ORIGIN:-}" && "$SITEMAP_ORIGIN" != "$EXPECT_SITEMAP_ORIGIN" ]]; then
    fail "/sitemap.xml uses ${SITEMAP_ORIGIN:-none} but ${EXPECT_SITEMAP_ORIGIN} was expected"
  elif [[ "$BASE_URL" == https://* && "$SITEMAP_ORIGIN" != "$BASE_URL" ]]; then
    warn "/sitemap.xml uses ${SITEMAP_ORIGIN:-none} while this host is $BASE_URL — PUBLIC_ORIGIN is not this deployment's origin (crawlers would be sent elsewhere)"
  else
    pass "/sitemap.xml → 200 with ${LOC_COUNT} <loc> entries on ${SITEMAP_ORIGIN:-none}"
  fi
else
  fail "/sitemap.xml → HTTP $CODE"
fi

# ── 7. favicon (official brand icon) ────────────────────────────────────────
RESP="$(fetch_head "$BASE_URL/brand/favicon/favicon-32.png" identity)"; CODE="$(status_of "$RESP")"; CT="$(header_of "$RESP" content-type)"
if [[ "$CODE" == "200" ]] && [[ "$CT" == image/* ]]; then
  pass "/brand/favicon/favicon-32.png → 200 ($CT)"
else
  fail "/brand/favicon/favicon-32.png → HTTP $CODE with content-type \"$CT\""
fi

# ── 8. admin gate ───────────────────────────────────────────────────────────
RESP="$(fetch "$BASE_URL/admin" identity)"; CODE="$(status_of "$RESP")"; BODY="$(printf '%s' "$RESP" | sed -n '/---BODY---/,$p')"
if [[ "$CODE" == "200" ]] && [[ "$BODY" == *'<div id="root"'* ]]; then
  pass "/admin → 200 (the CMS gate loads; sign in is the operator's step)"
else
  fail "/admin → HTTP $CODE"
fi

# ── 9. a missing file must not pretend to exist ─────────────────────────────
RESP="$(fetch_head "$BASE_URL/deploy-check-$$.png" identity)"; CODE="$(status_of "$RESP")"
if [[ "$CODE" == "404" ]]; then
  pass "a missing file answers 404 (no index.html masquerading as an asset)"
else
  fail "a missing file answers HTTP $CODE instead of 404"
fi

# ── 10. compression of the app shell ────────────────────────────────────────
RESP="$(fetch_head "$BASE_URL/" gzip)"; CODE="$(status_of "$RESP")"; ENC="$(header_of "$RESP" content-encoding)"
if [[ "$CODE" == "200" && "$ENC" == "gzip" ]]; then
  pass "/ answers gzip when the client accepts it"
elif [[ "$CODE" == "200" ]]; then
  fail "/ is served uncompressed — dist/index.html.gz is probably missing (npm run build writes it)"
else
  fail "/ with accept-encoding: gzip → HTTP $CODE"
fi

# ── 11. HSTS when the base is https ────────────────────────────────────────
if [[ "$BASE_URL" == https://* ]]; then
  RESP="$(fetch_head "$BASE_URL/" identity)"; HSTS="$(header_of "$RESP" strict-transport-security)"
  if [[ -n "$HSTS" ]]; then
    pass "HSTS present over HTTPS ($HSTS)"
  else
    fail "no strict-transport-security header over HTTPS (the app sends it when it sees https — check TRUST_PROXY and the proxy's X-Forwarded-Proto)"
  fi
  fi

echo "ilmNet deploy check — ${BASE_URL} — $(date -Is)"
for line in "${REPORT[@]}"; do echo "  $line"; done
echo "result: $PASSED passed, $FAILED failed${WARNED:+, $WARNED warning(s)}" 
[[ "$FAILED" -eq 0 ]] || exit 1
exit 0
