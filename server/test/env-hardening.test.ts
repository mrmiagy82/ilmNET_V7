/**
 * Fase 3.8.1 — regression test for the production env/security hardening.
 *
 * Reproduces the Fase 3.8 sanity-check finding: a leftover development `.env` in the server
 * directory could supply `NODE_ENV=development` and a well-known `ADMIN_TOKEN`, which silently
 * disabled the production guards.
 *
 * Two layers:
 *   1. in-process checks of the provenance/token helpers (lib/env.ts)
 *   2. child processes that boot the guard against a fixture directory containing a stale `.env`
 *      — real processes, real refusal messages, no mocks of the code under test
 *
 * Run: cd server && npm run test:env
 */
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  assertSecureAdminToken,
  declaredMode,
  envFilePaths,
  envOrigin,
  fileProvidedKeys,
  isProduction,
} from '../src/lib/env';
import { announceEnvironment } from './env-banner';

const SERVER_DIR = path.resolve(__dirname, '..');
const ENV_LIB = path.join(SERVER_DIR, 'src', 'lib', 'env.ts');
const TSX = path.join(SERVER_DIR, 'node_modules', '.bin', 'tsx');

let passed = 0;
let failed = 0;
const ok = (m: string) => {
  passed++;
  console.log(`✅ ${m}`);
};
const fail = (m: string) => {
  failed++;
  console.log(`❌ ${m}`);
};
const check = (cond: boolean, m: string) => (cond ? ok(m) : fail(m));

/** A stale development .env, exactly like the one the sanity check found on a "production" host. */
const STALE_ENV = [
  'NODE_ENV=development',
  'ADMIN_TOKEN=change-me-dev-only',
  'CORS_ORIGIN=http://localhost:5173',
].join('\n');

const STRONG_TOKEN = crypto.randomBytes(32).toString('hex');

type Scenario = {
  name: string;
  env: Record<string, string>;
  expect: 'boot' | 'refuse';
  message?: RegExp;
};

const SCENARIOS: Scenario[] = [
  {
    name: 'clean production env (all guard keys from the process environment)',
    env: {
      NODE_ENV: 'production',
      ADMIN_TOKEN: STRONG_TOKEN,
      CORS_ORIGIN: 'https://ilmnet.example',
      DATABASE_URL: 'postgresql://u:p@db:5432/ilmnet?schema=public',
    },
    expect: 'boot',
  },
  {
    name: 'production without ADMIN_TOKEN in the process env (stale .env would supply one)',
    env: {
      NODE_ENV: 'production',
      CORS_ORIGIN: 'https://ilmnet.example',
      DATABASE_URL: 'postgresql://u:p@db:5432/ilmnet?schema=public',
    },
    expect: 'refuse',
    message: /\.env file may not configure a production boot/i,
  },
  {
    name: 'production with a known dev token (change-me-dev-only) in the process env',
    env: {
      NODE_ENV: 'production',
      ADMIN_TOKEN: 'change-me-dev-only',
      CORS_ORIGIN: 'https://ilmnet.example',
    },
    expect: 'refuse',
    message: /must never authenticate a production deployment/i,
  },
  {
    name: 'production with a too-short token',
    env: { NODE_ENV: 'production', ADMIN_TOKEN: 'short', CORS_ORIGIN: 'https://ilmnet.example' },
    expect: 'refuse',
    message: /too short for production/i,
  },
  {
    name: 'deployment config but no NODE_ENV (stale .env says development)',
    env: { DATABASE_URL: 'postgresql://u:p@db:5432/ilmnet?schema=public' },
    expect: 'refuse',
    message: /NODE_ENV is not set in the process environment/i,
  },
  {
    name: 'local development via .env only (no process env at all)',
    env: {},
    expect: 'boot',
  },
  {
    name: 'explicit NODE_ENV=development with a database override (documented local escape)',
    env: { NODE_ENV: 'development', DATABASE_URL: 'postgresql://u:p@localhost:5432/ilmnet?schema=public' },
    expect: 'boot',
  },
];

function runGuard(fixtureDir: string, env: Record<string, string>) {
  const runner = path.join(fixtureDir, 'guard-runner.ts');
  fs.writeFileSync(
    runner,
    `import { assertBootConfiguration, declaredMode, isProduction } from ${JSON.stringify(ENV_LIB)};
try {
  assertBootConfiguration();
  console.log('BOOT-OK mode=' + declaredMode() + ' production=' + isProduction());
} catch (e: any) {
  console.log('REFUSED: ' + (e?.message ?? e));
  process.exit(3);
}
`,
  );
  const result = spawnSync(TSX, [runner], {
    cwd: fixtureDir,
    // a clean environment: only what the scenario declares (plus what a shell needs)
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env },
    encoding: 'utf8',
    timeout: 60000,
  });
  return { code: result.status, out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function main() {
  announceEnvironment('env/security hardening (Fase 3.8.1)');
  console.log(`Guard regression · lib: ${path.relative(SERVER_DIR, ENV_LIB)}\n`);

  // ── 1. provenance helpers ────────────────────────────────────────────────────
  console.log('--- 1. env provenance (in this process: a development checkout) ---');
  check(envOrigin('PATH') === 'process', 'PATH is reported as process-provided');
  check(envOrigin('ILMNET_DOES_NOT_EXIST') === 'unset', 'unknown keys are reported as unset');
  const files = envFilePaths();
  const hasServerEnv = fs.existsSync(path.join(SERVER_DIR, '.env'));
  if (hasServerEnv && process.env.ADMIN_TOKEN === undefined) {
    check(envOrigin('ADMIN_TOKEN') === 'file', `.env is recognised as the source of ADMIN_TOKEN (${files.join(', ')})`);
  } else {
    ok(`provenance check skipped (no unshadowed server/.env in this checkout: ${files.join(', ') || 'none'})`);
  }
  check(declaredMode() === 'development' && !isProduction(), 'a development checkout stays development');

  // ── 2. token strength (unit level) ───────────────────────────────────────────
  console.log('\n--- 2. admin token requirements ---');
  const weak = ['change-me-dev-only', 'ilmnet-admin-dev-2026', 'CHANGE_ME_NOW', 'your-token', 'short', 'abc123'];
  let allRejected = true;
  for (const value of weak) {
    try {
      assertSecureAdminToken(value);
      allRejected = false;
      fail(`weak token accepted: ${value}`);
    } catch {
      /* expected */
    }
  }
  check(allRejected, `all ${weak.length} known weak/short tokens are rejected`);
  let strongAccepted = true;
  try {
    assertSecureAdminToken(STRONG_TOKEN);
  } catch (e: any) {
    strongAccepted = false;
    fail(`strong token rejected: ${e?.message ?? e}`);
  }
  check(strongAccepted, 'a 64-character random token is accepted');

  // ── 3. real boots against a stale .env ───────────────────────────────────────
  console.log('\n--- 3. real guard runs against a stale .env (child processes) ---');
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ilmnet-env-hardening-'));
  fs.writeFileSync(path.join(fixtureDir, '.env'), STALE_ENV);
  try {
    for (const scenario of SCENARIOS) {
      const { code, out } = runGuard(fixtureDir, scenario.env);
      const booted = code === 0 && /BOOT-OK/.test(out);
      const refused = code !== 0 && /REFUSED:/.test(out);
      if (scenario.expect === 'boot') {
        const mode = /mode=(\w+)/.exec(out)?.[1] ?? '?';
        check(booted, `${scenario.name} → boots (mode=${mode})`);
      } else {
        const message = /REFUSED: (.*)/.exec(out)?.[1] ?? '';
        const matches = scenario.message ? scenario.message.test(message) : true;
        check(
          refused && matches,
          `${scenario.name} → refused${matches ? '' : ` (unexpected message: ${message.slice(0, 110)})`}`,
        );
      }
    }
  } finally {
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }

  console.log(`\n${failed === 0 ? '✅ Env hardening regression passed' : `❌ ${failed} checks failed`} (${passed} passed, ${failed} failed)`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
