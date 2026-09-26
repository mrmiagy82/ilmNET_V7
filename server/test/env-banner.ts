/**
 * Environment banner for the server test suites (environment rule, docs/ENVIRONMENTS.md).
 *
 * Every suite states **which environment and which configuration it runs against**, so a green or red
 * result can never be read as if it were about another target. It prints:
 *
 *   - the ilmNet environment identity (`development` | `staging` | `production`) and where it came
 *     from, plus `NODE_ENV`;
 *   - whether a `.env` file is in play (a suite whose config comes from a file is a development run);
 *   - the database target — **with credentials stripped**: the suite proves its target, it never
 *     spreads a password into a log;
 *   - the API target when one is set (`API_URL`/`SITE_URL`/`BASE_URL`).
 *
 * No secrets are printed, ever: `DATABASE_URL` is reduced to `user@host:port/database` without the
 * password, and nothing else from the environment is echoed but the three names above.
 */
import { activeEnvironment, declaredMode, environmentSource, envFilePaths } from '../src/lib/env';

/** `postgresql://user:secret@host:5432/db?schema=public` → `user@host:5432/db` (password dropped). */
export function describeTarget(url: string | undefined): string {
  if (!url) return 'not set';
  try {
    const parsed = new URL(url);
    const database = parsed.pathname.replace(/^\//, '') || '?';
    return `${parsed.username ? `${parsed.username}@` : ''}${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}/${database}`;
  } catch {
    // Anything unparseable is reported as present-but-unreadable rather than echoed verbatim.
    return 'set (unparseable — not printed)';
  }
}

export function announceEnvironment(suite: string): void {
  const environment = activeEnvironment();
  const source = environmentSource();
  const files = envFilePaths();
  const database = describeTarget(process.env.DATABASE_URL);
  const api = process.env.API_URL || process.env.SITE_URL || process.env.BASE_URL || 'not set';

  console.log('===============================================================');
  console.log(`Suite    : ${suite}`);
  console.log(`Environment: ${environment} · NODE_ENV=${declaredMode()} · identity from ${source}`);
  console.log(`Config file: ${files.length ? files.join(', ') : 'none (process environment only)'}`);
  console.log(`Database : ${database}`);
  console.log(`API target: ${api}`);
  if (environment === 'staging') {
    console.log('Note     : staging target — crawling is disabled on staging by design (robots.txt, x-robots-tag).');
  }
  if (environment === 'production') {
    console.log('Note     : production target — a run against production is only ever a read-only check.');
  }
  console.log('===============================================================\n');
}
