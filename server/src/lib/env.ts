/**
 * Environment resolution + production guard rails (Fase 3.8.1).
 *
 * Why this module exists
 * ----------------------
 * `dotenv` — and Prisma's own loader — read `.env` files from the working directory and from the
 * schema directory. A leftover development `.env` on a production host could therefore supply
 * `NODE_ENV=development`, a well-known `ADMIN_TOKEN` and localhost CORS origins, silently turning
 * the production guard rails off (the Fase 3.8 sanity check reproduced exactly that).
 *
 * This module makes the *origin* of every relevant variable explicit:
 *   - process environment (systemd `EnvironmentFile`, docker compose `environment:`, PaaS panel,
 *     docker `--env-file`) → authoritative
 *   - `.env` file                     → local development convenience only
 *
 * Rules enforced at boot (`assertBootConfiguration()`):
 *   R1  mode: the process environment wins; otherwise the file value; otherwise `development`.
 *   R2  a process that carries deployment configuration (DATABASE_URL / ADMIN_TOKEN / CORS_ORIGIN /
 *       UPLOADS_DIR) must declare `NODE_ENV` explicitly — no silent fallback to development.
 *   R3  in production the guard keys (NODE_ENV, ADMIN_TOKEN, CORS_ORIGIN, ADMIN_ALLOW_LOCALHOST)
 *       may not come from a `.env` file.
 *   R4  in production the admin token must be production-grade: at least 16 characters and never a
 *       known development/placeholder value (including the values shipped in `.env.example`).
 *
 * `isProductionSafe()` exposes the same reasoning in a non-throwing form for destructive scripts
 * (the demo seed), so an ambiguous boot is treated as production there.
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

/** Snapshot of the real process environment, taken before any `.env` file can be applied. */
const PROCESS_ENV: Readonly<Record<string, string | undefined>> = Object.freeze({ ...process.env });

const SERVER_ROOT = path.resolve(__dirname, '..', '..');

const ENV_FILE_CANDIDATES = [
  path.resolve(SERVER_ROOT, '.env'),
  path.resolve(process.cwd(), '.env'),
];

/** Guard keys: configuration that decides whether the production protections are active. */
const GUARD_KEYS = ['NODE_ENV', 'ADMIN_TOKEN', 'CORS_ORIGIN', 'ADMIN_ALLOW_LOCALHOST'];

/** Deployment signals: a process environment that carries these is a deployment, not a laptop. */
const DEPLOYMENT_KEYS = ['DATABASE_URL', 'ADMIN_TOKEN', 'CORS_ORIGIN', 'UPLOADS_DIR'];

const MIN_ADMIN_TOKEN_LENGTH = 16;

/** Values that must never authenticate a production deployment. */
const KNOWN_WEAK_TOKENS = new Set(['change-me-dev-only', 'ilmnet-admin-dev-2026', 'changeme', 'your-token', 'admin-token']);
const WEAK_TOKEN_PATTERNS: Array<[RegExp, string]> = [
  [/change[-_ ]?me/i, 'placeholder value ("change-me…")'],
  [/^ilmnet[-_]admin[-_]dev/i, 'the development token shipped with the project'],
  [/^dev([-_]|$)/i, 'a development token'],
  [/^test([-_]|$)/i, 'a test token'],
  [/your[-_ ]?(token|secret)/i, 'placeholder value ("your-token…")'],
  [/example|placeholder|sample/i, 'example/placeholder value'],
];

function readEnvFiles(): { paths: string[]; values: Record<string, string> } {
  const paths: string[] = [];
  const values: Record<string, string> = {};
  for (const file of ENV_FILE_CANDIDATES) {
    if (paths.includes(file) || !fs.existsSync(file)) continue;
    paths.push(file);
    try {
      const parsed = dotenv.parse(fs.readFileSync(file));
      // first file wins, mirroring dotenv's non-overriding behaviour
      for (const [key, value] of Object.entries(parsed)) if (values[key] === undefined) values[key] = value;
    } catch {
      /* unreadable file: treat as absent */
    }
  }
  return { paths, values };
}

const ENV_FILES = readEnvFiles();

/** Admin token values shipped as examples in the repository (never valid in production). */
function tokenValuesFromExamples(): string[] {
  const files = [path.resolve(SERVER_ROOT, '.env.example'), path.resolve(SERVER_ROOT, '..', '.env.example')];
  const values: string[] = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    try {
      const parsed = dotenv.parse(fs.readFileSync(file));
      for (const key of ['ADMIN_TOKEN', 'VITE_ADMIN_TOKEN']) {
        const value = parsed[key]?.trim();
        if (value) values.push(value);
      }
    } catch {
      /* ignore */
    }
  }
  return values;
}

const WEAK_TOKEN_VALUES = new Set(
  [...KNOWN_WEAK_TOKENS, ...tokenValuesFromExamples()].map((v) => v.toLowerCase()),
);

/** Apply file values for keys the process environment did not provide (development convenience). */
function applyEnvFiles(): void {
  for (const [key, value] of Object.entries(ENV_FILES.values)) {
    if (PROCESS_ENV[key] === undefined && process.env[key] === undefined) process.env[key] = value;
  }
}

/** Resolution mode: process environment wins, then the `.env` file, then development. */
export function declaredMode(): 'production' | 'development' {
  const current = process.env.NODE_ENV?.trim();
  if (current) return current === 'production' ? 'production' : 'development';
  const fromFile = ENV_FILES.values.NODE_ENV?.trim();
  if (fromFile) return fromFile === 'production' ? 'production' : 'development';
  return 'development';
}

export function isProduction(): boolean {
  return declaredMode() === 'production';
}

/** `.env` files that were found (server directory + working directory). */
export function envFilePaths(): string[] {
  return [...ENV_FILES.paths];
}

/** Where a variable came from: the process environment, a `.env` file, or nowhere. */
export function envOrigin(key: string): 'process' | 'file' | 'unset' {
  if (PROCESS_ENV[key] !== undefined) return 'process';
  if (ENV_FILES.values[key] !== undefined) return 'file';
  return 'unset';
}

/**
 * Keys that are *configured by a `.env` file*: not provided by the process environment, present in
 * a file, and not supplied by anything else (unset, or already holding the file's value). A value
 * assigned at runtime therefore does not count as file-provided.
 */
export function fileProvidedKeys(keys: string[]): string[] {
  return keys.filter((key) => {
    if (PROCESS_ENV[key] !== undefined) return false; // the process environment is authoritative
    const fileValue = ENV_FILES.values[key];
    if (fileValue === undefined) return false; // the file has nothing for this key
    const current = process.env[key];
    return current === undefined || current === fileValue;
  });
}

// ── Legacy admin token (Fase 5.3) ───────────────────────────────────────────────
/**
 * Is the legacy shared `ADMIN_TOKEN` accepted as an alternative to a signed-in operator?
 *
 * `ADMIN_LEGACY_TOKEN` is the switch. Unset it means: **enabled in development** (scripts, curl, the
 * local test suites rely on it and never face the public internet) and **disabled in production**,
 * where a single non-revocable string must not be a second key to every admin right (audit I6).
 * A production host that really needs it for CI or a script opts in explicitly with
 * `ADMIN_LEGACY_TOKEN=true` — and then the production rules for `ADMIN_TOKEN` apply unchanged
 * (≥16 characters, no known/placeholder value). The value `'undefined'`/`'null'` counts as unset,
 * because `process.env.X = undefined` stores the *string* "undefined".
 */
export function legacyAdminTokenEnabled(): boolean {
  const raw = process.env.ADMIN_LEGACY_TOKEN?.trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'undefined' || raw === 'null') return !isProduction();
  return !isProduction();
}

/** Human readable description of the admin authentication posture (boot log + /api/health). */
export function adminAuthPosture(): 'sessions' | 'sessions+legacy-token' {
  return legacyAdminTokenEnabled() ? 'sessions+legacy-token' : 'sessions';
}

/**
 * Would anybody be able to administer this deployment? Called once at boot, after the database is
 * reachable. With the legacy token switched off, a deployment without a single active operator
 * account has no way in: the CMS would be permanently unreachable and the only fix is SQL/CLI access
 * on the host. Refusing to start makes that visible immediately instead of after a deploy.
 *
 * Pure function on purpose: the caller supplies the real account count, so the rule itself is
 * testable without touching Prisma.
 */
export function assertAdminAccessPossible(input: {
  mode: 'production' | 'development';
  legacyTokenEnabled: boolean;
  activeAccounts: number;
}): void {
  if (input.mode !== 'production' || input.legacyTokenEnabled || input.activeAccounts > 0) return;
  throw new Error(
    'No way in: the legacy ADMIN_TOKEN is disabled in production and the admin_users table has no active account. ' +
      'Create one first (npm run admin:create -- --username <name> --password \'<password>\'), ' +
      'or set ADMIN_LEGACY_TOKEN=true (with a strong ADMIN_TOKEN) if a script really needs the shared token.',
  );
}

/** Deployment configuration present in the real process environment (not from a file). */
function deploymentKeysFromProcess(): string[] {
  return DEPLOYMENT_KEYS.filter((key) => {
    const value = PROCESS_ENV[key];
    return value !== undefined && value.trim() !== '';
  });
}

/** Is this boot (or an equivalent one) a production environment? Never returns true for `npm run dev`. */
export function isProductionSafe(): boolean {
  return isProduction() || undeclaredModeOnDeployment();
}

/** A process with deployment configuration but no explicit NODE_ENV anywhere in the real env. */
function undeclaredModeOnDeployment(): boolean {
  return PROCESS_ENV.NODE_ENV === undefined && deploymentKeysFromProcess().length > 0;
}

/** Validate an admin token against the production requirements (throws with the reason). */
export function assertSecureAdminToken(token: string): void {
  const value = token.trim();
  if (value.length < MIN_ADMIN_TOKEN_LENGTH) {
    throw new Error(
      `ADMIN_TOKEN is too short for production (${value.length} characters, minimum ${MIN_ADMIN_TOKEN_LENGTH}). ` +
        'Generate one with: openssl rand -hex 32',
    );
  }
  const known = WEAK_TOKEN_VALUES.has(value.toLowerCase());
  if (known) {
    throw new Error(
      'ADMIN_TOKEN is a known development/example value and must never authenticate a production deployment. ' +
        'Generate a unique token with: openssl rand -hex 32',
    );
  }
  for (const [pattern, what] of WEAK_TOKEN_PATTERNS) {
    if (pattern.test(value)) {
      throw new Error(
        `ADMIN_TOKEN looks like ${what} and must never authenticate a production deployment. ` +
          'Generate a unique token with: openssl rand -hex 32',
      );
    }
  }
}

/**
 * Boot guard rails. Called from `buildApp()` (at call time, so tests can exercise production mode)
 * and by the destructive seed path through `isProductionSafe()`.
 */
export function assertBootConfiguration(): void {
  const mode = declaredMode();

  // R2 — a deployment must declare its mode; never fall back to development silently.
  // (An explicit NODE_ENV=development in the process environment stays a valid opt-in for local
  // runs that point at another database.)
  if (mode !== 'production') {
    const deployed = deploymentKeysFromProcess();
    if (PROCESS_ENV.NODE_ENV === undefined && deployed.length) {
      throw new Error(
        `NODE_ENV is not set in the process environment, but deployment configuration was found there (${deployed.join(', ')}). ` +
          'ilmNet refuses to guess the mode. Set NODE_ENV=production for a deployment, or NODE_ENV=development explicitly for a local run.',
      );
    }
    applyEnvFiles();
    return;
  }

  // R3 — a `.env` file may not configure a production boot.
  const fromFile = fileProvidedKeys(GUARD_KEYS);
  if (fromFile.length) {
    throw new Error(
      `A .env file may not configure a production boot: ${fromFile.join(', ')} came from ${ENV_FILES.paths.join(', ')}. ` +
        'In production all configuration must come from the process environment ' +
        '(systemd EnvironmentFile, docker compose environment:, PaaS env vars). ' +
        'Remove the .env file from the server directory, or set these variables in the service environment.',
    );
  }

  // R4 — the admin token must be production-grade.
  const token = process.env.ADMIN_TOKEN?.trim();
  if (token) assertSecureAdminToken(token);

  // Visibility: a `.env` file is never the source of a production deployment.
  if (ENV_FILES.paths.length) {
    const extra = fileProvidedKeys(Object.keys(ENV_FILES.values));
    // eslint-disable-next-line no-console
    console.warn(
      `[ilmNet] .env file(s) found during a production boot: ${ENV_FILES.paths.join(', ')}. ` +
        'Production configuration must come from the process environment' +
        (extra.length ? `; keys still taken from those files: ${extra.join(', ')}` : '; none of their keys was applied') +
        '.',
    );
  }
}
