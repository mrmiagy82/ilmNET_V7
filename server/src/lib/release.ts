import fs from 'fs';
import path from 'path';

/**
 * Release identity (Fase 5.6).
 *
 * Operations needs one question answered by the running service: *which* release is this? Without it
 * a deploy cannot be verified and a rollback cannot be confirmed — an operator ends up comparing
 * timestamps in a shell instead of asking the API. `/api/health` reports this, and the boot log prints
 * it, so both the first request and the startup line say what is live.
 *
 * - `version` comes from `server/package.json` (never a hard-coded string that drifts from the file).
 * - `commit` is what the deployment puts in `GIT_COMMIT` (e.g. `GIT_COMMIT=$(git rev-parse --short HEAD)`
 *   in the service environment). Unset → `null`: the service says it does not know rather than guessing,
 *   and a host that prefers not to publish its commit simply leaves the variable out.
 * - Never a build timestamp (no build step knows one here) and never anything secret.
 */
export interface ReleaseInfo {
  version: string;
  commit: string | null;
}

let cached: ReleaseInfo | null = null;

export function releaseInfo(): ReleaseInfo {
  if (cached) return cached;

  let version = 'unknown';
  try {
    // Works from source (`src/lib` → `server/package.json`) and from the build (`dist/lib` → the same
    // file): both are two levels below the server root.
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
    if (typeof pkg?.version === 'string' && pkg.version.trim()) version = pkg.version.trim();
  } catch {
    // A missing/unreadable package.json must never break the health check.
  }

  const commitRaw = (process.env.GIT_COMMIT ?? '').trim();
  cached = { version, commit: commitRaw ? commitRaw.slice(0, 40) : null };
  return cached;
}

/** Short form for log lines: `1.0.0 (a1b2c3d)` or `1.0.0 (no GIT_COMMIT)`. */
export function releaseLabel(): string {
  const { version, commit } = releaseInfo();
  return `${version} (${commit ? commit.slice(0, 7) : 'no GIT_COMMIT'})`;
}

/** Testing helper: forget the cached read (the suite changes GIT_COMMIT between apps). */
export function resetReleaseCache(): void {
  cached = null;
}
