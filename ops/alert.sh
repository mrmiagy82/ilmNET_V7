#!/usr/bin/env bash
#
# ilmNet — alert: send one message to wherever the operator actually looks.
#
#   ops/alert.sh --subject "ilmNet healthcheck FAIL on web-1" --body "…" [--severity critical]
#   echo "one line" | ops/alert.sh --subject "backup failed"
#   ops/alert.sh --subject "test" --body "hello" --dry-run
#
# Used by ops/healthcheck.sh and by the systemd units (`ilmnet-alert@.service`, triggered through
# `OnFailure=`), so a failing backup or API does not stay silent in a journal nobody reads.
#
# Delivery, in order — whichever is configured, all of them are tried:
#   1. ALERT_WEBHOOK_URL  POSTs a small JSON body ({service, host, severity, subject, body, timestamp}).
#                         Works with Slack/Discord/Mattermost webhooks, Healthchecks.io, Uptime Kuma,
#                         ntfy, a small relay … anything that accepts JSON over HTTP.
#   2. ALERT_MAIL_TO      pipes the same text to `mail -s` when that command exists (local MTA).
#   3. Always             prints the alert to stderr, so systemd/cron/docker logs keep a copy.
#
# Rules:
#   - the exit status is 0 even when delivery fails: an alert helper must never be the reason a
#     service unit is marked failed. The delivery problem is reported on stderr instead.
#   - message text is sanitised before it leaves the host: credentials in URLs and token-looking
#     strings are redacted, so an alert cannot become a secret leak in someone's chat channel.
#   - every value in the JSON payload is escaped, not just the body: a quote in a subject (systemd
#     passes the failing unit name through `%i`) used to reach the receiver as invalid JSON while
#     this script still reported success. One builder (`json_payload`) is shared by the dry run and
#     the real POST so they cannot drift apart.
#   - `--dry-run` prints exactly what would be sent, and sends nothing. Use it to test a webhook
#     setup without triggering a false incident.
#
# Exit codes: 0 delivered (or printed) · 2 no delivery channel configured and not a dry run ·
#             3 usage error. `--dry-run` always exits 0.
#
# NO new dependencies: curl (optional for the webhook), mail (optional), coreutils.
set -Eeuo pipefail

SERVICE_NAME="${ALERT_SERVICE_NAME:-ilmnet}"
SUBJECT=""
BODY=""
SEVERITY="critical"
DRY_RUN=0
FROM_STDIN=0

die() { echo "error: $*" >&2; exit "${2:-3}"; }
usage() { sed -n '2,34p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit "${1:-3}"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --subject)  SUBJECT="${2:-}"; shift 2 ;;
    --body)     BODY="${2:-}"; shift 2 ;;
    --severity) SEVERITY="${2:-}"; shift 2 ;;
    --dry-run)  DRY_RUN=1; shift ;;
    -h|--help)  usage 0 ;;
    -)          FROM_STDIN=1; shift ;;
    *) die "unknown option: $1 (try --help)" 3 ;;
  esac
done

[[ "$SEVERITY" =~ ^(info|warning|critical)$ ]] || die "severity must be info, warning or critical" 3

if [[ "$FROM_STDIN" -eq 1 || ( -z "$BODY" && ! -t 0 ) ]]; then
  BODY="$(cat)"
fi
[[ -n "$SUBJECT" ]] || die "--subject is required" 3

# ── sanitise: no credentials, no tokens, no connection strings leaving the host ──────────────
sanitize() {
  sed -E \
    -e 's#([a-zA-Z][a-zA-Z0-9+.-]*://)[^@/[:space:]]*@#\1***@#g' \
    -e 's#(ghp_|github_pat_|glpat-)[A-Za-z0-9_]+#\1***#g' \
    -e 's#((token|password|secret|api[_-]?key)["'"'"']?[[:space:]]*[:=][[:space:]]*)[^"'"'"'[:space:]]+#\1***#Ig'
}
# JSON string escaping without jq/python: backslashes, quotes and real newlines (the last one matters —
# a multi-line alert must stay readable in Slack/Discord instead of being flattened into one line).
# Control characters that would otherwise make the payload invalid JSON (a quote in a systemd `%i`
# unit name used to reach the receiver raw) are escaped too — every value that goes into the payload
# runs through this function, not just the body.
json_escape() {
  printf '%s' "$1" \
    | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\t/\\t/g' -e 's/\r//g' -e 's/\x08/\\b/g' -e 's/\x0c/\\f/g' \
    | awk 'BEGIN {ORS="\\n"} {print}' | sed 's/\\n$//'
}

# One place builds the payload so the dry run and the real POST cannot drift apart.
json_payload() {
  printf '{"service":"%s","host":"%s","severity":"%s","subject":"%s","timestamp":"%s","body":"%s"}' \
    "$(json_escape "$SERVICE_NAME")" "$(json_escape "$HOSTNAME_SHORT")" "$(json_escape "$SEVERITY")" \
    "$(json_escape "$SUBJECT_CLEAN")" "$(json_escape "$STAMP")" "$(json_escape "$BODY_CLEAN")"
}

SUBJECT_CLEAN="$(printf '%s' "$SUBJECT" | sanitize)"
BODY_CLEAN="$(printf '%s' "$BODY" | sanitize)"
HOSTNAME_SHORT="$(hostname 2>/dev/null || echo unknown)"
STAMP="$(date -Is)"
TEXT="[$SEVERITY] $SUBJECT_CLEAN
host: $HOSTNAME_SHORT
service: $SERVICE_NAME
time: $STAMP
$BODY_CLEAN"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "── dry run: nothing is sent ──"
  echo "$TEXT"
  if [[ -n "${ALERT_WEBHOOK_URL:-}" ]]; then
    echo "── would POST to ALERT_WEBHOOK_URL (${ALERT_WEBHOOK_URL%%\?*}): ──"
    printf '%s\n' "$(json_payload)"
  else
    echo "── ALERT_WEBHOOK_URL is not set (a webhook POST is skipped) ──"
  fi
  [[ -n "${ALERT_MAIL_TO:-}" ]] && echo "── would mail ALERT_MAIL_TO=$ALERT_MAIL_TO ──" || echo "── ALERT_MAIL_TO is not set (no mail is sent) ──"
  exit 0
fi

delivered=0
problems=0

if [[ -n "${ALERT_WEBHOOK_URL:-}" ]]; then
  if ! command -v curl >/dev/null 2>&1; then
    echo "alert: ALERT_WEBHOOK_URL is set but curl is not installed — webhook skipped" >&2
    problems=1
  else
    payload="$(json_payload)"
    if curl -sS --max-time "${ALERT_TIMEOUT:-10}" -X POST -H 'Content-Type: application/json' \
        --data-binary "$payload" "$ALERT_WEBHOOK_URL" >/dev/null 2>&1; then
      delivered=1
    else
      echo "alert: webhook POST failed (${ALERT_WEBHOOK_URL%%\?*})" >&2
      problems=1
    fi
  fi
fi

if [[ -n "${ALERT_MAIL_TO:-}" ]]; then
  if command -v mail >/dev/null 2>&1; then
    if printf '%s\n' "$TEXT" | mail -s "[$SERVICE_NAME] $SUBJECT_CLEAN" "$ALERT_MAIL_TO" 2>/dev/null; then
      delivered=1
    else
      echo "alert: mail delivery failed (ALERT_MAIL_TO=$ALERT_MAIL_TO)" >&2
      problems=1
    fi
  else
    echo "alert: ALERT_MAIL_TO is set but the 'mail' command is not installed — mail skipped" >&2
    problems=1
  fi
fi

# Always leave a copy in the log (journald/cron/docker capture stderr).
printf '%s\n' "$TEXT" >&2

if [[ "$delivered" -eq 0 && -z "${ALERT_WEBHOOK_URL:-}${ALERT_MAIL_TO:-}" ]]; then
  echo "alert: no delivery channel configured (set ALERT_WEBHOOK_URL or ALERT_MAIL_TO) — the message above is the only copy" >&2
  exit 2
fi
[[ "$problems" -eq 1 && "$delivered" -eq 0 ]] && exit 2
exit 0
