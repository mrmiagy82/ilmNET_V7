#!/usr/bin/env bash
#
# ilmNet — off-site copy: get the backup sets off this host.
#
#   BACKUP_DIR=/var/backups/ilmnet OFFSITE_TARGET=backup@other-host:/srv/ilmnet \\
#     ops/offsite-copy.sh --latest
#
#   ops/offsite-copy.sh --target /mnt/offsite/ilmnet --latest --dry-run
#
# Why this script exists: a backup on the same host does not survive a dead disk, a wrong `rm` or a
# provider incident — and the backup timer (Fase 5.1) only ever wrote locally. This copies the sets
# to whatever the operator has: another server over SSH, a mounted NAS/object-store gateway, or (for
# testing the procedure) a local directory.
#
# What it does:
#   1. picks the newest backup set in BACKUP_DIR (or every set without --latest);
#   2. copies dump + uploads archive + manifest to OFFSITE_TARGET with rsync;
#   3. when the target is a local path it verifies the copy afterwards (size + sha256 of dump and
#      uploads archive against the manifest) and fails if anything differs;
#   4. prints how to restore from that copy — including the drill command, because an off-site copy
#      that has never been restored is still an assumption (rules are in docs/DEPLOYMENT.md §6b).
#
# Env: BACKUP_DIR (default ./backups) · BACKUP_PREFIX (ilmnet) · OFFSITE_TARGET · OFFSITE_SSH_KEY ·
#      OFFSITE_EXTRA_ARGS (passed to rsync verbatim).
# Flags: --target <path|host:path> · --latest · --delete (mirror: remove sets on the target that are
#        gone locally — only with --all semantics) · --verify (checksum the transfer, slower) ·
#        --dry-run.
# Exit codes: 0 copied · 1 refused (unsafe target) · 2 a required tool is missing · 3 usage/config.
#
# NO new dependencies: rsync + coreutils (rclone/aws-cli users can mirror the same manifest with their
# own tool; the manifest is what makes any copy verifiable).
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
PREFIX="${BACKUP_PREFIX:-ilmnet}"
TARGET="${OFFSITE_TARGET:-}"
SSH_KEY="${OFFSITE_SSH_KEY:-}"
EXTRA_ARGS="${OFFSITE_EXTRA_ARGS:-}"

LATEST_ONLY=0
DO_DELETE=0
DO_VERIFY=1
DRY_RUN=0

die() { echo "error: $*" >&2; exit "${2:-3}"; }
info() { echo "  $*"; }
usage() { sed -n '2,30p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit "${1:-3}"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)  TARGET="${2:-}"; shift 2 ;;
    --latest)  LATEST_ONLY=1; shift ;;
    --delete)  DO_DELETE=1; shift ;;
    --verify)  DO_VERIFY=1; shift ;;
    --no-verify) DO_VERIFY=0; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --copy-method) COPY_METHOD="${2:-}"; shift 2 ;;
    -h|--help) usage 0 ;;
    *) die "unknown option: $1 (try --help)" 3 ;;
  esac
done

# rsync is the default (it works for local and remote targets and can checksum the transfer). A bare
# host without rsync can still copy to a *local* target with cp — the manifest check below then proves
# the copy, so the fallback is not a weaker guarantee, only a slower transport.
COPY_METHOD="${COPY_METHOD:-auto}"
case "$COPY_METHOD" in
  auto) if command -v rsync >/dev/null 2>&1; then COPY_METHOD=rsync; else COPY_METHOD=cp; fi ;;
  rsync|cp) ;;
  *) die "COPY_METHOD must be auto, rsync or cp" 3 ;;
esac
[[ -n "$TARGET" ]] || die "OFFSITE_TARGET/--target is required (e.g. user@host:/srv/backups/ilmnet or /mnt/offsite/ilmnet)" 3
[[ -d "$BACKUP_DIR" ]] || die "BACKUP_DIR does not exist: $BACKUP_DIR (nothing to copy)" 3
if [[ "$COPY_METHOD" == "rsync" ]] && ! command -v rsync >/dev/null 2>&1; then
  die "COPY_METHOD=rsync but rsync is not installed" 2
fi

# ── safety: an off-site copy that lands on the same disk, or inside the checkout, protects nothing ──
REMOTE=0
[[ "$TARGET" == *:* ]] && REMOTE=1
if [[ "$REMOTE" -eq 0 ]]; then
  mkdir -p "$TARGET" 2>/dev/null || die "cannot create the target directory: $TARGET" 1
  TARGET_ABS="$(cd "$TARGET" && pwd)"
  BACKUP_ABS="$(cd "$BACKUP_DIR" && pwd)"
  [[ "$TARGET_ABS" != "$BACKUP_ABS" && "$TARGET_ABS" != "$BACKUP_ABS"/* ]] || die "refusing: the target is inside BACKUP_DIR ($TARGET_ABS) — that is a copy, not an off-site backup" 1
  case "$TARGET_ABS" in
    "$REPO_ROOT"|"$REPO_ROOT"/*) die "refusing: the target is inside the repository checkout ($TARGET_ABS) — backups must never be committed" 1 ;;
  esac
  # Same filesystem ⇒ same disk ⇒ not off-site. Warn, do not refuse: bind mounts and NFS paths look
  # like different paths but can still be the same device.
  if [[ "$(df -P "$TARGET_ABS" | awk 'NR==2 {print $1}')" == "$(df -P "$BACKUP_ABS" | awk 'NR==2 {print $1}')" ]]; then
    echo "warning: $TARGET_ABS is on the same device as $BACKUP_DIR — this proves the procedure, but it is NOT an off-site copy" >&2
  fi
fi

# ── pick the sets ───────────────────────────────────────────────────────────
mapfile -t MANIFESTS < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name "${PREFIX}-manifest-*.txt" -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2-)
[[ "${#MANIFESTS[@]}" -gt 0 ]] || die "no backup sets found in $BACKUP_DIR (${PREFIX}-manifest-*.txt) — run ops/backup.sh first" 3

# The manifest name carries the timestamp; dump and uploads archive share it.
tstamp_of() { basename "$1" | sed -E "s/^${PREFIX}-manifest-(.*)\\.txt\$/\\1/"; }

declare -a FILES=()
for manifest in "${MANIFESTS[@]}"; do
  stamp="$(tstamp_of "$manifest")"
  FILES+=("$manifest")
  for kind in db uploads; do
    case "$kind" in
      db) candidate="$BACKUP_DIR/${PREFIX}-db-${stamp}.dump" ;;
      uploads) candidate="$BACKUP_DIR/${PREFIX}-uploads-${stamp}.tar.gz" ;;
    esac
    [[ -f "$candidate" ]] && FILES+=("$candidate")
  done
  [[ "$LATEST_ONLY" -eq 1 ]] && break
done

info "copying ${#FILES[@]} file(s) from $BACKUP_DIR to $TARGET"
[[ "$DRY_RUN" -eq 1 ]] && info "(dry run: nothing is transferred)"

# ── copy ────────────────────────────────────────────────────────────────────
RSYNC_ARGS=(-a --human-readable)
[[ "$DO_VERIFY" -eq 1 ]] && RSYNC_ARGS+=(--checksum)
[[ "$DO_DELETE" -eq 1 ]] && RSYNC_ARGS+=(--delete)
[[ -n "$EXTRA_ARGS" ]] && RSYNC_ARGS+=($EXTRA_ARGS)
if [[ "$REMOTE" -eq 1 && -n "$SSH_KEY" ]]; then
  RSYNC_ARGS+=(-e "ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new")
fi
[[ "$DRY_RUN" -eq 1 ]] && RSYNC_ARGS+=(--dry-run -v)

if [[ "$COPY_METHOD" == "rsync" ]]; then
  rsync "${RSYNC_ARGS[@]}" "${FILES[@]}" "$TARGET/" || die "rsync failed (exit $?)" 3
else
  [[ "$REMOTE" -eq 0 ]] || die "COPY_METHOD=cp only works for a local (mounted) target — install rsync for user@host:/path" 2
  [[ "$DO_DELETE" -eq 1 ]] && echo "warning: COPY_METHOD=cp ignores --delete (it copies, it does not mirror)" >&2
  for file in "${FILES[@]}"; do
    if [[ "$DRY_RUN" -eq 1 ]]; then
      info "[dry run] cp $file → $TARGET/"
    else
      cp -p "$file" "$TARGET/" || die "cp failed for $file" 3
    fi
  done
fi

# ── verify a local target against the manifest ──────────────────────────────
if [[ "$REMOTE" -eq 0 && "$DRY_RUN" -eq 0 ]]; then
  FAILED=0
  for manifest in "${MANIFESTS[@]}"; do
    stamp="$(tstamp_of "$manifest")"
    while IFS= read -r line; do
      case "$line" in
        dump=*|uploads=*)
          file="$(printf '%s' "${line#*=}" | cut -d' ' -f1)"
          want_size="$(printf '%s' "${line#*=}" | sed -E 's/.*size=([0-9]+).*/\1/')"
          want_sha="$(printf '%s' "${line#*=}" | sed -E 's/.*sha256=([0-9a-f]+).*/\1/')"
          copied="$TARGET/$file"
          if [[ ! -f "$copied" ]]; then
            echo "  FAIL $file is missing in the target" >&2
            FAILED=1
            continue
          fi
          got_size="$(stat -c%s "$copied")"
          got_sha="$(sha256sum "$copied" | cut -d' ' -f1)"
          if [[ "$got_size" == "$want_size" && "$got_sha" == "$want_sha" ]]; then
            info "verified $(basename "$file") — size and sha256 match the manifest"
          else
            echo "  FAIL $(basename "$file") differs (size $got_size vs $want_size, sha256 ${got_sha:0:12}… vs ${want_sha:0:12}…)" >&2
            FAILED=1
          fi
          ;;
      esac
    done < "$manifest"
  done
  [[ "$FAILED" -eq 0 ]] || die "the copy does not match the manifest — do not trust this target" 3
fi

# ── how to get it back ──────────────────────────────────────────────────────
newest_stamp="$(tstamp_of "${MANIFESTS[0]}")"
cat <<EOF

Off-site copy done.

Restore from this copy (never trust a copy you have not restored):
  # 1. prove it restores, against the copy itself:
  ops/restore-drill.sh --dump "<target>/${PREFIX}-db-${newest_stamp}.dump" \\
                       --uploads "<target>/${PREFIX}-uploads-${newest_stamp}.tar.gz"
  # 2. real restore on a fresh host (explicit target database, uploads to the volume):
  ops/restore.sh --dump "<target>/${PREFIX}-db-${newest_stamp}.dump" \\
                 --database-url "postgresql://ilmnet:…@localhost:5432/ilmnet" \\
                 --uploads "<target>/${PREFIX}-uploads-${newest_stamp}.tar.gz" --force
  # 3. then: npx prisma migrate deploy · restart the API · ops/deploy-check.sh --base https://<host>
EOF

if [[ "$REMOTE" -eq 1 ]]; then
  info "note: rsync verified the transfer itself; run the drill on the host that has the copy."
fi
