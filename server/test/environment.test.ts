/**
 * Environment rule — regression suite (docs/ENVIRONMENTS.md).
 *
 * ilmNet runs in exactly three environments: development, staging and production. This suite pins the
 * rules that keep them apart, so nothing can quietly run with the wrong guard rails:
 *
 *   1. identity      — `activeEnvironment()` maps ENVIRONMENT/NODE_ENV correctly and refuses a typo
 *   2. provenance    — where the identity came from (process / file / derived) is real, not assumed
 *   3. guard parity  — staging and production require NODE_ENV=production, in a **real child process**
 *                      (a development-configured process may never carry their identity)
 *   4. no dev config in staging/production — a `.env` file may not supply the identity or any guard key
 *   5. staging posture — staging publishes no crawlable surface: robots.txt disallows everything and
 *                      the sitemap advertises nothing (checked over real HTTP with Fastify inject,
 *                      against the actual route module — no mocks)
 *
 * Run: cd server && npm run test:environment
 */
import { spawnSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Fastify from 'fastify';
import { announceEnvironment } from './env-banner';
import { activeEnvironment, environmentLabel, environmentSource, isStaging } from '../src/lib/env';
import { seoRoutes } from '../src/routes/seo';

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

const STRONG_TOKEN = crypto.randomBytes(32).toString('hex');

/**
 * A stale development `.env`, exactly what the environment rule forbids around a staging or
 * production process: it supplies the mode, the identity and a well-known token.
 */
const STALE_ENV = [
  'NODE_ENV=development',
  'ENVIRONMENT=development',
  'ADMIN_TOKEN=change-me-dev-only',
  'CORS_ORIGIN=http://localhost:5173',
].join('\n');

type Scenario = {
  name: string;
  env: Record<string, string>;
  dotEnv?: string;
  expect: 'boot' | 'refuse';
  message?: RegExp;
};

const SCENARIOS: Scenario[] = [
  {
    name: 'staging with production configuration in the process environment (the intended shape)',
    env: {
      ENVIRONMENT: 'staging',
      NODE_ENV: 'production',
      ADMIN_TOKEN: STRONG_TOKEN,
      CORS_ORIGIN: 'https://staging.ilmnet.example',
      DATABASE_URL: 'postgresql://u:p@db:5432/ilmnet_staging?schema=public',
    },
    expect: 'boot',
    message: /staging/,
  },
  {
    name: 'production with production configuration in the process environment',
    env: {
      ENVIRONMENT: 'production',
      NODE_ENV: 'production',
      ADMIN_TOKEN: STRONG_TOKEN,
      CORS_ORIGIN: 'https://ilmnet.example',
      DATABASE_URL: 'postgresql://u:p@db:5432/ilmnet?schema=public',
    },
    expect: 'boot',
    message: /production/,
  },
  {
    name: 'production identity derived from NODE_ENV only (backwards compatible, logged as derived)',
    env: {
      NODE_ENV: 'production',
      ADMIN_TOKEN: STRONG_TOKEN,
      CORS_ORIGIN: 'https://ilmnet.example',
      DATABASE_URL: 'postgresql://u:p@db:5432/ilmnet?schema=public',
    },
    expect: 'boot',
    message: /derived/,
  },
  {
    name: 'ENVIRONMENT=staging without NODE_ENV=production (development configuration with a staging identity)',
    env: { ENVIRONMENT: 'staging', NODE_ENV: 'development', DATABASE_URL: 'postgresql://u:p@localhost:5432/ilmnet?schema=public' },
    expect: 'refuse',
    message: /requires NODE_ENV=production/i,
  },
  {
    // Nothing but the file says "staging": the identity must not be decided by a development file.
    name: 'ENVIRONMENT=staging from a stale .env alone (no process environment at all)',
    env: {},
    dotEnv: 'ENVIRONMENT=staging\nNODE_ENV=development\n',
    expect: 'refuse',
    message: /requires NODE_ENV=production/i,
  },
  {
    name: 'staging whose identity comes from a .env file next to a production mode',
    env: {
      NODE_ENV: 'production',
      ADMIN_TOKEN: STRONG_TOKEN,
      CORS_ORIGIN: 'https://staging.ilmnet.example',
      DATABASE_URL: 'postgresql://u:p@db:5432/ilmnet_staging?schema=public',
    },
    dotEnv: 'ENVIRONMENT=staging\n',
    expect: 'refuse',
    message: /\.env file may not configure a production boot/i,
  },
  {
    name: 'ENVIRONMENT=development on a production boot (contradiction)',
    env: {
      ENVIRONMENT: 'development',
      NODE_ENV: 'production',
      ADMIN_TOKEN: STRONG_TOKEN,
      CORS_ORIGIN: 'https://ilmnet.example',
      DATABASE_URL: 'postgresql://u:p@db:5432/ilmnet?schema=public',
    },
    expect: 'refuse',
    message: /ENVIRONMENT=development/i,
  },
  {
    name: 'unknown value (ENVIRONMENT=stagin) — a typo must never pick guard rails',
    env: {
      ENVIRONMENT: 'stagin',
      NODE_ENV: 'production',
      ADMIN_TOKEN: STRONG_TOKEN,
      CORS_ORIGIN: 'https://ilmnet.example',
      DATABASE_URL: 'postgresql://u:p@db:5432/ilmnet?schema=public',
    },
    expect: 'refuse',
    message: /unknown value/i,
  },
  {
    name: 'staging with a development-grade token (staging runs the production token rules)',
    env: {
      ENVIRONMENT: 'staging',
      NODE_ENV: 'production',
      ADMIN_TOKEN: 'change-me-dev-only',
      CORS_ORIGIN: 'https://staging.ilmnet.example',
      DATABASE_URL: 'postgresql://u:p@db:5432/ilmnet_staging?schema=public',
    },
    expect: 'refuse',
    message: /must never authenticate a production deployment/i,
  },
  // The CORS wildcard rule lives in `buildApp()` (server.ts) and is driven by the same
  // `isProduction()` flag that staging inherits; it is covered by the production suite. This suite
  // proves the parity that lives in the boot guards: staging is not a "softer" production.
  {
    name: 'plain local development (no ENVIRONMENT anywhere)',
    env: {},
    expect: 'boot',
    message: /development/,
  },
];

function runGuard(fixtureDir: string, env: Record<string, string>) {
  const runner = path.join(fixtureDir, 'guard-runner.ts');
  fs.writeFileSync(
    runner,
    `import { assertBootConfiguration, activeEnvironment, environmentSource, isStaging, declaredMode } from ${JSON.stringify(ENV_LIB)};
try {
  assertBootConfiguration();
  console.log(
    'BOOT-OK environment=' + activeEnvironment() +
    ' source=' + environmentSource() +
    ' staging=' + isStaging() +
    ' nodeEnv=' + declaredMode(),
  );
} catch (e: any) {
  console.log('REFUSED: ' + (e?.message ?? e));
  process.exit(3);
}
`,
  );
  const result = spawnSync(TSX, [runner], {
    cwd: fixtureDir,
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env },
    encoding: 'utf8',
    timeout: 60000,
  });
  return { code: result.status, out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/** Save and restore the three variables this suite touches in-process. */
function withEnvironment<T>(values: Record<string, string | undefined>, fn: () => T | Promise<T>): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const key of ['ENVIRONMENT', 'NODE_ENV', 'ADMIN_TOKEN', 'CORS_ORIGIN']) saved[key] = process.env[key];
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve(fn()).finally(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

async function main() {
  announceEnvironment('environment rule (identity, guard parity, staging posture)');

  // ── 1. identity mapping and provenance ────────────────────────────────────────
  console.log('--- 1. identity and provenance (in this process) ---');
  const realEnvironment = process.env.ENVIRONMENT;
  const realNodeEnv = process.env.NODE_ENV;

  await withEnvironment({ ENVIRONMENT: undefined, NODE_ENV: 'development' }, () => {
    check(activeEnvironment() === 'development', 'no ENVIRONMENT + NODE_ENV=development → development');
    check(environmentSource() === 'derived', 'an unsupplied identity is reported as derived (not guessed as process)');
    check(!isStaging(), 'isStaging() is false for a development process');
  });

  await withEnvironment({ ENVIRONMENT: undefined, NODE_ENV: 'production' }, () => {
    check(activeEnvironment() === 'production', 'no ENVIRONMENT + NODE_ENV=production → production (backwards compatible)');
  });

  await withEnvironment({ ENVIRONMENT: 'staging', NODE_ENV: 'production' }, () => {
    check(activeEnvironment() === 'staging', 'ENVIRONMENT=staging → staging');
    check(isStaging(), 'isStaging() is true for a staging process');
    check(environmentSource() === 'process', 'a process-provided identity is reported as process');
    check(/staging/.test(environmentLabel()), `environmentLabel() names the environment (${environmentLabel()})`);
  });

  await withEnvironment({ ENVIRONMENT: 'STAGING', NODE_ENV: 'production' }, () => {
    check(activeEnvironment() === 'staging', 'the value is case-insensitive (STAGING → staging)');
  });

  await withEnvironment({ ENVIRONMENT: 'undefined', NODE_ENV: 'development' }, () => {
    check(activeEnvironment() === 'development', 'the string "undefined" counts as unset (the process.env footgun)');
  });

  let typoRefused = false;
  try {
    await withEnvironment({ ENVIRONMENT: 'stagin', NODE_ENV: 'production' }, () => activeEnvironment());
  } catch (e: any) {
    typoRefused = /unknown value/i.test(e?.message ?? '');
  }
  check(typoRefused, 'a misspelled environment value is refused instead of silently defaulting');

  // ── 2. guard parity in real child processes ───────────────────────────────────
  console.log('\n--- 2. guard parity (real processes, real refusal messages) ---');
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ilmnet-env-'));
  for (const [index, scenario] of SCENARIOS.entries()) {
    const fixtureDir = path.join(fixtureRoot, `scenario-${index}`);
    fs.mkdirSync(fixtureDir, { recursive: true });
    if (scenario.dotEnv) fs.writeFileSync(path.join(fixtureDir, '.env'), scenario.dotEnv);

    const result = runGuard(fixtureDir, scenario.env);
    const booted = /BOOT-OK/.test(result.out);
    const refused = /REFUSED:/.test(result.out);

    if (scenario.expect === 'boot') {
      check(booted && !refused, `${scenario.name} → boots`);
      if (scenario.message) check(scenario.message.test(result.out), `   … and reports "${scenario.message.source}"`);
    } else {
      const matched = refused && (!scenario.message || scenario.message.test(result.out));
      check(matched, `${scenario.name} → refused${scenario.message ? ` with "${scenario.message.source}"` : ''}`);
      if (!matched) console.log(`   ↳ ${result.out.trim().split('\n').slice(-2).join(' | ')}`);
    }
  }

  // ── 3. the stale .env cannot decide for a staging or production boot ─────────
  console.log('\n--- 3. development configuration never reaches staging/production ---');
  const staleDir = path.join(fixtureRoot, 'stale-env');
  fs.mkdirSync(staleDir, { recursive: true });
  fs.writeFileSync(path.join(staleDir, '.env'), STALE_ENV);
  const staleNoProcessEnv = runGuard(staleDir, { DATABASE_URL: 'postgresql://u:p@localhost:5432/ilmnet?schema=public' });
  check(
    /REFUSED/.test(staleNoProcessEnv.out) && /NODE_ENV is not set in the process environment/i.test(staleNoProcessEnv.out),
    'a stale .env next to deployment configuration refuses the boot (mode may not come from the file)',
  );
  // When the deployment supplies every guard key itself, the stale file cannot shadow anything: the
  // boot proceeds with the process values and the file is reported as ignored.
  const staleNextToStaging = runGuard(staleDir, {
    NODE_ENV: 'production',
    ENVIRONMENT: 'staging',
    ADMIN_TOKEN: STRONG_TOKEN,
    CORS_ORIGIN: 'https://staging.ilmnet.example',
    DATABASE_URL: 'postgresql://u:p@db:5432/ilmnet_staging?schema=public',
  });
  check(
    /BOOT-OK environment=staging source=process/.test(staleNextToStaging.out),
    'a stale .env cannot shadow a staging boot: the identity stays the deployment\'s own',
  );
  check(
    /\.env file\(s\) found during a production boot/i.test(staleNextToStaging.out),
    '   … and the leftover file is reported, so the host problem stays visible',
  );
  // The same file, but with a guard key the deployment forgot, is a refusal (that is R3).
  const staleWithOneKeyFromFile = runGuard(staleDir, {
    NODE_ENV: 'production',
    ENVIRONMENT: 'staging',
    ADMIN_TOKEN: STRONG_TOKEN,
    DATABASE_URL: 'postgresql://u:p@db:5432/ilmnet_staging?schema=public',
  });
  check(
    /REFUSED/.test(staleWithOneKeyFromFile.out) && /\.env file may not configure a production boot/i.test(staleWithOneKeyFromFile.out),
    'a guard key taken from the leftover .env refuses the boot (CORS_ORIGIN was missing from the deployment)',
  );

  // ── 4. staging posture over real HTTP (the actual route module, no mocks) ─────
  console.log('\n--- 4. staging publishes no crawlable surface (Fastify inject) ---');
  const app = Fastify({ logger: false });
  await app.register(seoRoutes);
  await app.ready();

  try {
    await withEnvironment({ ENVIRONMENT: 'staging', NODE_ENV: 'production' }, async () => {
      const robots = await app.inject({ method: 'GET', url: '/robots.txt' });
      check(robots.statusCode === 200, `staging robots.txt answers 200 (got ${robots.statusCode})`);
      check(/Disallow: \//.test(robots.body), 'staging robots.txt disallows everything');
      check(!/^Allow: \/$/m.test(robots.body), 'staging robots.txt does not allow the site');
      check(!/Sitemap:/.test(robots.body), 'staging robots.txt advertises no sitemap');

      const sitemap = await app.inject({ method: 'GET', url: '/sitemap.xml' });
      check(sitemap.statusCode === 200, `staging sitemap.xml answers 200 (got ${sitemap.statusCode})`);
      check(/<urlset/.test(sitemap.body), 'staging sitemap.xml is valid XML');
      check((sitemap.body.match(/<url>/g) ?? []).length === 0, 'staging sitemap.xml lists no URLs');
      check(/staging/i.test(sitemap.body), 'staging sitemap.xml says why it is empty');
    });

    await withEnvironment({ ENVIRONMENT: 'production', NODE_ENV: 'production' }, async () => {
      const robots = await app.inject({ method: 'GET', url: '/robots.txt' });
      check(/Allow: \//.test(robots.body) && /Disallow: \/admin/.test(robots.body), 'production robots.txt keeps the normal crawl rules');
    });
  } finally {
    await app.close();
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    // restore whatever this checkout really had
    if (realEnvironment === undefined) delete process.env.ENVIRONMENT;
    else process.env.ENVIRONMENT = realEnvironment;
    if (realNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = realNodeEnv;
  }

  console.log(`\n${failed === 0 ? '✅' : '❌'} environment rule: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
