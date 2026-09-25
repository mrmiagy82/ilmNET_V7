/**
 * Admin account management (Fase 4.5) — the only way to create or maintain operators.
 *
 *   npm run admin:create   -- --username admin --password '…' [--name "Display name"] [--role admin|editor]
 *   npm run admin:password -- --username admin --password '…'      # also revokes every session
 *   npm run admin:disable  -- --username admin                     # also revokes every session
 *   npm run admin:enable   -- --username admin
 *   npm run admin:list
 *
 * The password may also come from the `ADMIN_PASSWORD` environment variable (useful for CI, keeps
 * it out of the shell history). Passwords and hashes are never printed; only the username, id and
 * state are echoed back.
 */
import { prisma } from '../lib/prisma';
import { assertPasswordPolicy, destroyUserSessions, hashPassword, normalizeUsername, purgeExpiredSessions } from '../lib/auth';

type Flags = Record<string, string | boolean>;

function parseArgs(argv: string[]): Flags {
  const flags: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

function usage(): never {
  console.error(
    [
      'Usage:',
      "  admin-user.ts create   --username <name> [--password <pw>] [--name <display>] [--role admin|editor]",
      "  admin-user.ts password --username <name> [--password <pw>]",
      "  admin-user.ts disable  --username <name>",
      "  admin-user.ts enable   --username <name>",
      "  admin-user.ts list",
      '',
      'A password may be passed with --password or the ADMIN_PASSWORD environment variable.',
    ].join('\n'),
  );
  process.exit(1);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseArgs(rest);
  const username = typeof flags.username === 'string' ? normalizeUsername(flags.username) : '';
  const password =
    (typeof flags.password === 'string' ? flags.password : '') || (process.env.ADMIN_PASSWORD ?? '').trim();
  const displayName = typeof flags.name === 'string' ? flags.name.trim() : null;
  const role = typeof flags.role === 'string' ? flags.role.trim() : 'admin';

  if (!command) usage();

  if (command === 'list') {
    await purgeExpiredSessions().catch(() => {});
    const users = await prisma.adminUser.findMany({
      orderBy: { username: 'asc' },
      include: { _count: { select: { sessions: true } } },
    });
    if (!users.length) {
      console.log('No admin accounts yet. Create one with: npm run admin:create -- --username <name>');
      return;
    }
    console.log('username              role    state     last login                 sessions');
    for (const u of users) {
      console.log(
        [
          u.username.padEnd(21),
          u.role.padEnd(7),
          (u.disabled ? 'disabled' : 'active').padEnd(9),
          (u.lastLoginAt ? u.lastLoginAt.toISOString() : 'never').padEnd(26),
          String(u._count.sessions),
        ].join(' '),
      );
    }
    return;
  }

  if (!username) usage();

  if (command === 'create') {
    if (!password) {
      console.error('A password is required: --password <value> or ADMIN_PASSWORD=<value>.');
      process.exit(1);
    }
    assertPasswordPolicy(password, username);
    if (role !== 'admin' && role !== 'editor') {
      console.error('Role must be "admin" or "editor".');
      process.exit(1);
    }
    const existing = await prisma.adminUser.findUnique({ where: { username } });
    if (existing) {
      console.error(`Admin "${username}" already exists — use admin:password to change its password.`);
      process.exit(1);
    }
    const user = await prisma.adminUser.create({
      data: { username, displayName, role, passwordHash: await hashPassword(password) },
    });
    console.log(`✅ Admin "${user.username}" created (id ${user.id}, role ${user.role}).`);
    return;
  }

  if (command === 'password') {
    if (!password) {
      console.error('A new password is required: --password <value> or ADMIN_PASSWORD=<value>.');
      process.exit(1);
    }
    assertPasswordPolicy(password, username);
    const existing = await prisma.adminUser.findUnique({ where: { username } });
    if (!existing) {
      console.error(`No admin "${username}" found.`);
      process.exit(1);
    }
    await prisma.adminUser.update({ where: { id: existing.id }, data: { passwordHash: await hashPassword(password) } });
    const revoked = await destroyUserSessions(existing.id);
    console.log(`✅ Password updated for "${existing.username}" — ${revoked} session(s) revoked.`);
    return;
  }

  if (command === 'disable' || command === 'enable') {
    const disabled = command === 'disable';
    const existing = await prisma.adminUser.findUnique({ where: { username } });
    if (!existing) {
      console.error(`No admin "${username}" found.`);
      process.exit(1);
    }
    await prisma.adminUser.update({ where: { id: existing.id }, data: { disabled } });
    const revoked = disabled ? await destroyUserSessions(existing.id) : 0;
    console.log(
      `✅ Admin "${existing.username}" is now ${disabled ? 'disabled' : 'active'}` +
        (disabled ? ` — ${revoked} session(s) revoked.` : '.'),
    );
    return;
  }

  usage();
}

main()
  .catch((err) => {
    console.error('❌', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
