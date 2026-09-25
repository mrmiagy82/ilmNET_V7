/**
 * Fase 5.6.1 — regression tests for the operations guards that the Fase 5.1–5.6 end-audit broke on.
 *
 * Every check here reproduces a bug that was found by *running* the scripts, and every check fails on
 * the pre-5.6.1 code:
 *
 *   P1  `ops/restore-drill.sh` reported PASSED while nothing had been compared (a missing manifest was
 *       silently treated as "no manifest entry, skip" for all seven tables).
 *   P2  `ops/alert.sh` escaped only the body: a quote in the subject produced invalid JSON at the
 *       receiver while the script still exited 0.
 *   P3  `ops/healthcheck.sh` deleted the health response before reading it, so the release
 *       (`version (commit)`) never reached the log or the alert.
 *   P15 `ops/healthcheck.sh --quiet` suppressed the failure lines too (0 bytes of log, exit 1) and
 *       `ilmnet-healthcheck.service` counted a script error as success via `SuccessExitStatus=0 1 2`.
 *
 * Hermetic by design: a stub HTTP server supplies the API responses and the alert receiver, so no
 * database, no running ilmNet server and no network are needed. Skips (never fails) when `curl` or an
 * executable `ops/*.sh` is missing.
 *
 * Run: cd server && npm run test:ops   (part of `npm run test:all`)
 */
import { execFile, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OPS = path.join(REPO_ROOT, 'ops');

let passed = 0;
let failed = 0;
let skipped = 0;
const ok = (m: string) => {
  passed++;
  console.log(`✅ ${m}`);
};
const fail = (m: string) => {
  failed++;
  console.log(`❌ ${m}`);
};
const check = (cond: boolean, m: string) => (cond ? ok(m) : fail(m));
const skip = (m: string) => {
  skipped++;
  console.log(`⏭️  ${m}`);
};

type Run = { status: number; stdout: string; stderr: string; output: string };

/**
 * Run a bash script with a clean, explicit environment (no DATABASE_URL leaking in from the suite).
 * Asynchronous on purpose: this process also *serves* the stub API the script talks to, and a
 * spawnSync here would block the event loop so the stub could never answer (curl then times out).
 */
function run(script: string, args: string[] = [], env: Record<string, string> = {}): Promise<Run> {
  return new Promise((resolve) => {
    execFile(
      'bash',
      [script, ...args],
      {
        encoding: 'utf8',
        timeout: 30_000,
        maxBuffer: 4 * 1024 * 1024,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          LC_ALL: 'C',
          TZ: 'UTC',
          ...env,
        } as NodeJS.ProcessEnv,
      },
      (error, stdout, stderr) => {
        const status = error ? (typeof (error as any).code === 'number' ? (error as any).code : -1) : 0;
        resolve({ status, stdout: stdout ?? '', stderr: stderr ?? '', output: `${stdout ?? ''}${stderr ?? ''}` });
      },
    );
  });
}

function have(cmd: string): boolean {
  return spawnSync('bash', ['-c', `command -v ${cmd} >/dev/null 2>&1`]).status === 0;
}

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Minimal HTTP server: a map of path → {status, body}, plus the requests it received. */
function serve(routes: Record<string, { status: number; body: string }>) {
  const seen: string[] = [];
  const server = http.createServer((req, res) => {
    const hit = routes[new URL(req.url ?? '/', 'http://127.0.0.1').pathname];
    seen.push(req.url ?? '');
    if (!hit) {
      res.writeHead(404).end('{}');
      return;
    }
    res.writeHead(hit.status, { 'content-type': 'application/json' }).end(hit.body);
  });
  return new Promise<{ port: number; seen: string[]; close: () => Promise<void> }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ port, seen, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}

/** A receiver that parses what it gets, exactly like a webhook endpoint would. */
function receiver() {
  const results: Array<{ parsed: boolean; error?: string; payload?: any; bytes: number }> = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        results.push({ parsed: true, payload: JSON.parse(body), bytes: body.length });
      } catch (e: any) {
        results.push({ parsed: false, error: e?.message ?? String(e), bytes: body.length });
      }
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
    });
  });
  return new Promise<{ port: number; results: typeof results; close: () => Promise<void> }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ port, results, close: () => new Promise((r) => server.close(() => r())) });
    });
  });
}

async function main() {
  if (!have('bash') || !fs.existsSync(path.join(OPS, 'alert.sh'))) {
    skip('ops scripts or bash are not available in this environment');
    console.log('\n✅ ops regression passed (nothing to run) (0 passed, 0 failed)');
    process.exit(0);
  }

  // ── P2: the alert payload must be valid JSON, whatever the subject contains ──────────────────
  console.log('--- P2. alert.sh: the JSON payload escapes every value ---');
  const trickySubject = 'ilmNet unit failed: ilmnet-alert@ilmnet-backup.service.service on "web-1"';
  const trickyBody = 'line1\npostgresql://ilmnet:s3cr3t@db:5432/ilmnet?schema=public  token=abcdef123456	tab';
  const dry = await run(
    path.join(OPS, 'alert.sh'),
    ['--dry-run', '--subject', trickySubject, '--body', trickyBody],
    { ALERT_WEBHOOK_URL: 'https://hooks.example.com/services/XXXX/YYYY', ALERT_SERVICE_NAME: 'ilmnet@web-1' },
  );
  const payloadLine = dry.stdout.split('\n').find((l) => l.startsWith('{"service"')) ?? '';
  let parsed: any = null;
  try {
    parsed = JSON.parse(payloadLine);
  } catch {
    parsed = null;
  }
  check(Boolean(parsed), `--dry-run prints a payload a JSON parser accepts (${payloadLine.slice(0, 80)}…)`);
  check(
    parsed?.subject === trickySubject,
    `a quote in the subject survives parsing untouched (${JSON.stringify(parsed?.subject ?? null)})`,
  );
  check(
    !payloadLine.includes('\t') && (parsed?.body ?? '').includes('\ttab'),
    'a tab in the body is escaped instead of travelling raw inside the JSON string',
  );
  check(
    (parsed?.body ?? '').includes('***@') && !(parsed?.body ?? '').includes('s3cr3t'),
    'credentials in a URL are still redacted before the payload leaves the host',
  );

  if (have('curl')) {
    const rec = await receiver();
    try {
      const posted = await run(
        path.join(OPS, 'alert.sh'),
        ['--subject', 'ilmNet healthcheck FAIL on "web-1"', '--body', trickyBody],
        { ALERT_WEBHOOK_URL: `http://127.0.0.1:${rec.port}/hook`, ALERT_SERVICE_NAME: 'ilmnet@web-1' },
      );
      check(rec.results.length === 1 && rec.results[0].parsed, 'a real POST is parsed by the receiver (no PARSE-ERROR)');
      check(
        rec.results[0]?.payload?.subject === 'ilmNet healthcheck FAIL on "web-1"',
        'the receiver sees the original subject, quote included',
      );
      check(posted.status === 0, `alert.sh exits 0 on a successful delivery (exit ${posted.status})`);
    } finally {
      await rec.close();
    }
  } else {
    skip('curl is not installed — the webhook POST path was not exercised');
  }

  if (!have('curl')) {
    skip('curl is not installed — the watchdog checks were skipped');
  } else {
    // ── P3: the watchdog reports the release the API answers with ──────────────────────────────
    console.log('\n--- P3. healthcheck.sh: the release of the answering API is reported ---');
    const healthy = await serve({
      '/api/health': { status: 200, body: '{"status":"ok","version":"9.9.9-stub","commit":"deadbee","database":"up","storage":"ok"}' },
      '/api/ready': { status: 200, body: '{"status":"ready","database":"up"}' },
    });
    try {
      const health = await run(
        path.join(OPS, 'healthcheck.sh'),
        ['--base', `http://127.0.0.1:${healthy.port}`],
        { BACKUP_MAX_AGE_HOURS: '0', DISK_PATHS: os.tmpdir() },
      );
      check(
        health.stdout.includes('release reported by /api/health: 9.9.9-stub (deadbee)'),
        `the log names the live release (stdout: ${health.stdout.split('\n').find((l) => l.includes('release')) ?? 'MISSING'})`,
      );
      check(
        health.status === 0 && health.stdout.includes('result: OK'),
        `a healthy host exits 0 with an OK summary (exit ${health.status})`,
      );

      // ── P15: --quiet silences a healthy run, never a failing one ─────────────────────────────
      console.log('\n--- P15. healthcheck.sh --quiet: a failure is never silent ---');
      const quietHealthy = await run(
        path.join(OPS, 'healthcheck.sh'),
        ['--quiet', '--base', `http://127.0.0.1:${healthy.port}`],
        { BACKUP_MAX_AGE_HOURS: '0', DISK_PATHS: os.tmpdir() },
      );
      check(
        quietHealthy.status === 0 && quietHealthy.output.length === 0,
        `a healthy --quiet run stays completely silent (exit ${quietHealthy.status}, ${quietHealthy.output.length} bytes)`,
      );

      const quietBroken = await run(path.join(OPS, 'healthcheck.sh'), ['--quiet', '--base', 'http://127.0.0.1:3199'], {
        BACKUP_MAX_AGE_HOURS: '0',
      });
      check(quietBroken.status === 1, `a failing --quiet run exits 1 (exit ${quietBroken.status})`);
      check(
        quietBroken.stderr.includes('FAIL health') && quietBroken.stderr.includes('result: FAIL'),
        `a failing --quiet run still writes its FAIL lines and summary to stderr (${quietBroken.stderr.length} bytes)`,
      );
      check(
        quietBroken.stderr.includes('ALERT_WEBHOOK_URL'),
        'a failing --quiet run says that no alert channel is configured (so an operator knows nobody was paged)',
      );

      const degraded = await serve({
        '/api/health': { status: 200, body: '{"status":"ok","version":"1.2.3","commit":"c0ffee1","database":"up","storage":"ok"}' },
        '/api/ready': { status: 503, body: '{"status":"degraded","database":"down"}' },
      });
      try {
        const quietDegraded = await run(
          path.join(OPS, 'healthcheck.sh'),
          ['--quiet', '--base', `http://127.0.0.1:${degraded.port}`],
          { BACKUP_MAX_AGE_HOURS: '0' },
        );
        check(
          quietDegraded.status === 1 && quietDegraded.stderr.includes('release: 1.2.3 (c0ffee1)'),
          `a failing --quiet run names the release that was live (${quietDegraded.stderr.includes('release:') ? 'release line present' : 'release line MISSING'})`,
        );
      } finally {
        await degraded.close();
      }
    } finally {
      await healthy.close();
    }
  }

  // ── P15b: the unit must not turn a script error into success ─────────────────────────────────
  console.log('\n--- P15b. systemd unit: exit 1 is handled, exit 2/3 are failures ---');
  const unit = fs.readFileSync(path.join(OPS, 'systemd', 'ilmnet-healthcheck.service'), 'utf8');
  check(
    /^SuccessExitStatus=0 1$/m.test(unit),
    'ilmnet-healthcheck.service accepts exit 0 and 1 only, so a missing tool / usage error fails the unit and fires OnFailure',
  );
  check(
    unit.includes('healthcheck.sh --quiet') && /--quiet/.test(unit),
    'the unit still runs the watchdog with --quiet (the script, not the unit, decides what to print)',
  );

  // ── P5 (doc): no HSTS claim that the watchdog does not implement ─────────────────────────────
  console.log('\n--- P5. the watchdog documentation does not promise an HSTS check ---');
  const envExample = fs.readFileSync(path.join(OPS, 'systemd', 'healthcheck.env.example'), 'utf8');
  check(
    !/verifies HSTS|verifieert HSTS|HSTS over https\b.*checked/i.test(envExample),
    'healthcheck.env.example no longer claims the watchdog verifies HSTS',
  );
  check(
    /curl -sI https:\/\//.test(envExample),
    'healthcheck.env.example shows the manual HSTS command instead',
  );

  // ── P1: a drill without a manifest refuses to run ────────────────────────────────────────────
  console.log('\n--- P1. restore-drill.sh refuses to drill without a manifest ---');
  const drillDir = tmpDir('ilmnet-drill-');
  const backupDir = tmpDir('ilmnet-empty-backups-');
  try {
    const dump = path.join(drillDir, 'ilmnet-db-20260101-000000.dump');
    fs.writeFileSync(dump, 'not a real dump — the guard must trip before anything is restored\n');
    const noManifest = await run(
      path.join(OPS, 'restore-drill.sh'),
      ['--dump', dump, '--drop-after'],
      { BACKUP_DIR: backupDir, DATABASE_URL: 'postgresql://ilmnet:pw@127.0.0.1:5432/ilmnet_probe' },
    );
    check(
      noManifest.status === 1,
      `a dump without a manifest stops with exit 1 instead of reporting a result (exit ${noManifest.status})`,
    );
    check(
      /no manifest/i.test(noManifest.stderr) && !/PASSED/i.test(noManifest.output),
      'the refusal says why, and nothing prints PASSED',
    );

    // The same set *with* a manifest passes the guard and fails only on the missing configuration, so
    // the guard is about the manifest and not about a blanket refusal to run.
    fs.writeFileSync(path.join(drillDir, 'ilmnet-manifest-20260101-000000.txt'), 'dump=ilmnet-db-20260101-000000.dump\ncontents=0\n');
    const withManifest = await run(
      path.join(OPS, 'restore-drill.sh'),
      ['--dump', dump, '--drop-after'],
      { BACKUP_DIR: backupDir },
    );
    check(
      withManifest.status === 1 && /DATABASE_URL is required/.test(withManifest.stderr),
      `with a manifest next to the dump the guard passes and the next missing piece is reported (exit ${withManifest.status}: ${withManifest.stderr.trim().slice(0, 60)}…)`,
    );
  } finally {
    fs.rmSync(drillDir, { recursive: true, force: true });
    fs.rmSync(backupDir, { recursive: true, force: true });
  }

  console.log(
    `\n${failed === 0 ? '✅ ops regression passed' : `❌ ${failed} checks failed`} (${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''})`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

void main();
