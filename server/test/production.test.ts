/**
 * Fase 3.7 — production readiness tests (real HTTP + real DB, no mocks)
 *
 * Covers:
 *  1. admin protection in production mode: every /api/admin read/write needs a token,
 *     every non-GET /api/* route needs a token, and mismatching tokens are rejected
 *  2. legacy public write aliases are gone (no unprotected publish/create/delete)
 *  3. draft / archived content and unpublished scholars & subjects never leak publicly
 *  4. uploads: path traversal blocked, only image files, size/type limits enforced
 *  5. storage: UPLOADS_DIR override, health reports storage + admin protection
 *  6. deploy: fail-fast without ADMIN_TOKEN in production, frontend build served when present
 *  7. TLS readiness (Fase 5.1) and proxy trust (Fase 5.2): HSTS only over HTTPS, forwarded
 *     headers only from a configured proxy, redirect target never taken from the request,
 *     readiness probe
 *  8. data & security hardening (Fase 5.3): the public payload is a positive list (no createdBy /
 *     updatedBy / importJobId, no draft content on a scholar page), destructive admin calls must
 *     name what they destroy, uploads are recognised by their bytes, the legacy token is off by
 *     default and health no longer publishes the upload path
 *  9. crawler surface & headers (Fase 5.5): /robots.txt and /sitemap.xml are real responses built
 *     from published rows only, the sitemap compresses and caches, a missing *file* is a 404 while a
 *     missing *page* still gets the app shell, and the security headers are the documented set
 * 10. operations (Fase 5.6): the API reports the release it runs (version from server/package.json,
 *     commit from GIT_COMMIT) and LOG_LEVEL changes the log level without breaking the boot
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import Fastify from 'fastify';
import { buildApp } from '../src/server';
import { prisma } from '../src/lib/prisma';
import { getUploadsDir, listUploadFiles, uploadsHealth } from '../src/lib/storage';
import { trustProxyIsEnabled, trustProxySetting } from '../src/lib/proxy';
import { hashPassword } from '../src/lib/auth';
import { request as httpRequest } from 'node:http';
import { INTERNAL_CONTENT_KEYS, LIST_JOIN_SCHOLAR_KEYS, PUBLIC_CONTENT_KEYS } from '../src/lib/public-payload';
import { adminAuthPosture, assertAdminAccessPossible, legacyAdminTokenEnabled } from '../src/lib/env';
import { resetSeoCache } from '../src/routes/seo';
import { releaseInfo, resetReleaseCache } from '../src/lib/release';
import { gunzipSync } from 'node:zlib';

// Fase 3.8.1: production refuses development/placeholder tokens, so the suite uses a
// production-grade value (a real deployment provides its own via the process environment).
const TOKEN = process.env.TEST_ADMIN_TOKEN || 'ilmnet-production-suite-2f9c41a7e5b2d48c6';
const WRONG = 'definitely-not-the-token';
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

/** Build an app in production mode on a custom port so the localhost dev-bypass never applies. */
async function prodApp() {
  process.env.NODE_ENV = 'production';
  process.env.ADMIN_TOKEN = TOKEN;
  // Fase 5.3: in production the legacy token is off unless a host opts in. This suite plays the role
  // of a script/CI host that still drives the API with a token (section 6e proves the other posture).
  process.env.ADMIN_LEGACY_TOKEN = 'true';
  process.env.CORS_ORIGIN = 'https://ilmnet.example,https://www.ilmnet.example';
  const app = await buildApp();
  const address = await app.listen({ port: 0, host: '127.0.0.1' });
  const base = `${address}`;
  // Requests are sent through a raw socket to a public-looking Host header so the
  // dev localhost bypass (which never runs in production) cannot mask a missing check.
  return { app, base };
}

async function raw(method: string, url: string, body?: any, token?: string): Promise<{ status: number; json: any }> {
  const res = await fetch(url, {
    method,
    headers: {
      'content-type': 'application/json',
      host: 'ilmnet.example',
      ...(token ? { 'x-admin-token': token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

/** Bodyless request without a JSON content-type (so Fastify does not reject it before routing). */
async function noBody(method: string, url: string, token?: string): Promise<{ status: number; json: any }> {
  const res = await fetch(url, {
    method,
    headers: { host: 'ilmnet.example', ...(token ? { 'x-admin-token': token } : {}) },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

/** Restore an env var exactly: `process.env.X = undefined` would store the string "undefined". */
function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

/** Every key (with its path) found anywhere in a JSON value — used to prove nothing internal leaks. */
function findKeysDeep(value: any, keys: string[], path = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => findKeysDeep(v, keys, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => [
      ...(keys.includes(k) ? [`${path}${path ? '.' : ''}${k}`] : []),
      ...findKeysDeep(v, keys, `${path}${path ? '.' : ''}${k}`),
    ]);
  }
  return [];
}

async function main() {
  const { app, base } = await prodApp();
  const createdIds: string[] = [];

  try {
    console.log('--- 1. Production health + admin protection ---');
    const health = await raw('GET', `${base}/api/health`);
    check(health.status === 200, `health is public (${health.status})`);
    check(health.json.database === 'up', 'health reports database up');
    check(health.json.storage?.writable === true, 'health reports writable storage');
    check(
      health.json.storage?.dir === undefined,
      `health does not publish the upload directory of the host (${JSON.stringify(health.json.storage ?? {})})`,
    );
    check(
      health.json.adminProtection === 'sessions+legacy-token',
      `health reports the admin posture honestly (${health.json.adminProtection})`,
    );

    const adminRead = await raw('GET', `${base}/api/admin/contents`);
    check(adminRead.status === 401, `GET /api/admin/contents without token → 401 (got ${adminRead.status})`);

    const adminReadOk = await raw('GET', `${base}/api/admin/contents`, undefined, TOKEN);
    check(adminReadOk.status === 200, 'GET /api/admin/contents with token → 200');

    const wrongToken = await raw('GET', `${base}/api/admin/contents`, undefined, WRONG);
    check(wrongToken.status === 401, `wrong token → 401 (got ${wrongToken.status})`);

    const tokenWrongLength = await raw('GET', `${base}/api/admin/contents`, undefined, TOKEN.slice(0, 5));
    check(tokenWrongLength.status === 401, 'short/guessed token → 401 (timing-safe compare)');

    const uploadsNoToken = await raw('GET', `${base}/api/admin/uploads`);
    check(uploadsNoToken.status === 401, `GET /api/admin/uploads without token → 401 (got ${uploadsNoToken.status})`);

    const importJobsNoToken = await raw('GET', `${base}/api/admin/imports`);
    check(importJobsNoToken.status === 401, `import jobs without token → 401 (got ${importJobsNoToken.status})`);

    console.log('\n--- 2. Legacy public write aliases removed ---');
    const publicWrite = await raw('POST', `${base}/api/contents`, {
      type: 'audio',
      title: 'Public write attempt',
      provider: 'archive',
      sourceUrl: 'https://archive.org/details/RenewingOurIntentions',
    });
    check(publicWrite.status !== 201 && publicWrite.status !== 200, `POST /api/contents is gone (${publicWrite.status})`);

    const publicSubjects = await raw('POST', `${base}/api/subjects`, { name: 'Hacked shelf', group: 'Belief' });
    check(publicSubjects.status !== 201 && publicSubjects.status !== 200, `POST /api/subjects is gone (${publicSubjects.status})`);

    const publicScholars = await raw('POST', `${base}/api/scholars`, { name: 'Injected scholar' });
    check(publicScholars.status !== 201 && publicScholars.status !== 200, `POST /api/scholars is gone (${publicScholars.status})`);

    const someContent = await prisma.content.findFirst({ where: { status: 'published' } });
    if (someContent) {
      const publicPublish = await raw('POST', `${base}/api/contents/${someContent.id}/publish`);
      check(publicPublish.status !== 200, `POST /api/contents/:id/publish is gone (${publicPublish.status})`);
    } else {
      fail('no published content available to probe the publish alias');
    }

    console.log('\n--- 3. No draft / archived leakage on public endpoints ---');
    const archivedFill = await prisma.content.findFirst({ where: { status: 'archived' } });
    const stamp = Date.now();
    const draft = await prisma.content.create({
      data: {
        type: 'audio',
        title: `Prod draft probe ${stamp}`,
        slug: `prod-draft-probe-${stamp}`,
        provider: 'archive',
        sourceUrl: 'https://archive.org/details/RenewingOurIntentions',
        status: 'draft',
      },
    });
    const archived =
      archivedFill ??
      (await prisma.content.create({
        data: {
          type: 'audio',
          title: `Prod archived probe ${stamp}`,
          slug: `prod-archived-probe-${stamp}`,
          provider: 'archive',
          sourceUrl: 'https://archive.org/details/RenewingOurIntentions',
          status: 'archived',
        },
      }));
    if (!archivedFill) createdIds.push(archived.id);
    createdIds.push(draft.id);

    const publicList = await raw('GET', `${base}/api/contents?limit=100`);
    const ids = (publicList.json.data ?? []).map((c: any) => c.id);
    check(!ids.includes(draft.id), 'draft is absent from the public list');
    check(!ids.includes(archived.id), 'archived is absent from the public list');

    const draftDetail = await raw('GET', `${base}/api/contents/${draft.id}`);
    check(draftDetail.status === 404, `draft detail is 404 (got ${draftDetail.status})`);
    const draftBySlug = await raw('GET', `${base}/api/contents/${draft.slug}`);
    check(draftBySlug.status === 404, `draft detail by slug is 404 (got ${draftBySlug.status})`);

    const draftScholar = await prisma.scholar.findFirst({ where: { status: 'draft' } });
    const draftSubject = await prisma.subject.findFirst({ where: { status: 'draft' } });
    const scholars = await raw('GET', `${base}/api/scholars`);
    const subjects = await raw('GET', `${base}/api/subjects`);
    check(
      !draftScholar || !(scholars.json.data ?? []).some((s: any) => s.id === draftScholar.id),
      'draft scholars are not exposed publicly',
    );
    check(
      !draftSubject || !(subjects.json.data ?? []).some((s: any) => s.id === draftSubject.id),
      'draft subjects are not exposed publicly',
    );
    if (draftSubject) {
      const bySlug = await raw('GET', `${base}/api/subjects/${draftSubject.slug}`);
      check(bySlug.status === 404, `draft subject detail is 404 (got ${bySlug.status})`);
    }
    if (draftScholar) {
      const sDetail = await raw('GET', `${base}/api/scholars/${draftScholar.slug}`);
      check(sDetail.status === 404, `draft scholar detail is 404 (got ${sDetail.status})`);
    }

    console.log('\n--- 4. Upload hardening ---');
    const traversal = await noBody('DELETE', `${base}/api/admin/uploads/${encodeURIComponent('../../.env')}`, TOKEN);
    check(traversal.status === 404 || traversal.status === 400, `path traversal in DELETE upload is blocked (${traversal.status})`);
    check(fs.existsSync(path.join(process.cwd(), '.env')), '.env file untouched after traversal attempt');

    const traversalEncoded = await noBody('DELETE', `${base}/api/admin/uploads/..%2F..%2FSENTINEL.txt`, TOKEN);
    check(
      traversalEncoded.status === 400 && traversalEncoded.json?.error?.code === 'INVALID_FILENAME',
      `percent-encoded traversal is rejected with INVALID_FILENAME (${traversalEncoded.status} ${traversalEncoded.json?.error?.code})`,
    );
    check(
      !fs.existsSync(path.join(getUploadsDir(), 'SENTINEL.txt')),
      'traversal attempt did not delete a same-named file inside the uploads dir',
    );

    // a real upload must still be deletable (the strict check does not break normal use)
    const pngBody = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
      'base64',
    );
    const boundary = '----ilmnetProduction' + Date.now();
    const multipart = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="delete-me.png"\r\nContent-Type: image/png\r\n\r\n`,
      ),
      pngBody,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const uploadRes = await fetch(`${base}/api/admin/uploads`, {
      method: 'POST',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, 'x-admin-token': TOKEN },
      body: multipart,
    });
    const uploadJson = await uploadRes.json().catch(() => ({}));
    const filename = uploadJson?.data?.filename;
    check(uploadRes.status === 201 && Boolean(filename), `upload for delete-check created (${uploadRes.status})`);
    if (filename) {
      const removable = await noBody('DELETE', `${base}/api/admin/uploads/${filename}`, TOKEN);
      check(removable.status === 200, `a genuine upload is still deletable (${removable.status})`);
      check(!fs.existsSync(path.join(getUploadsDir(), filename)), 'deleted upload is gone from disk');
    }

    const traversalStatic = await raw('GET', `${base}/uploads/${encodeURIComponent('../.env')}`);
    check(traversalStatic.status === 404 || traversalStatic.status === 400, `static /uploads traversal blocked (${traversalStatic.status})`);

    const noFile = await fetch(`${base}/api/admin/uploads`, { method: 'POST', headers: { 'x-admin-token': TOKEN, host: 'ilmnet.example' } });
    check(noFile.status === 400, `upload without multipart body → 400 (${noFile.status})`);

    const uploadNoToken = await fetch(`${base}/api/admin/uploads`, { method: 'POST', headers: { host: 'ilmnet.example' } });
    check(uploadNoToken.status === 401, `upload without token → 401 (${uploadNoToken.status})`);

    console.log('\n--- 5. Storage configuration ---');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ilmnet-uploads-'));
    const previous = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = tmpDir;
    check(getUploadsDir() === tmpDir, `UPLOADS_DIR override is honoured (${getUploadsDir()})`);
    const health2 = uploadsHealth();
    check(health2.dir === tmpDir && health2.custom === true, 'health marks storage as a custom (persistent) volume');
    check(health2.writable === true, 'custom storage directory is writable');
    check(listUploadFiles().length === 0, 'empty custom storage lists no files');
    if (previous) process.env.UPLOADS_DIR = previous; else delete process.env.UPLOADS_DIR;
    fs.rmdirSync(tmpDir);

    console.log('\n--- 6. Deployment guards ---');
    process.env.NODE_ENV = 'production';
    const savedToken = process.env.ADMIN_TOKEN;
    delete process.env.ADMIN_TOKEN;
    let refuseMessage = '';
    try {
      await buildApp();
    } catch (e: any) {
      refuseMessage = e?.message ?? '';
    }
    // Without a token in the process environment the boot is refused: either because the token is
    // missing entirely, or — when a development .env is present — because that file may not
    // configure a production boot (Fase 3.8.1).
    check(
      /ADMIN_TOKEN is missing|\.env file may not configure a production boot/i.test(refuseMessage),
      `production boot with the legacy token enabled but no ADMIN_TOKEN is refused (${refuseMessage.slice(0, 60)}…)`,
    );
    process.env.ADMIN_TOKEN = savedToken;

    const badCors = process.env.CORS_ORIGIN;
    process.env.CORS_ORIGIN = '*';
    let corsRefused = false;
    try {
      await buildApp();
    } catch (e: any) {
      corsRefused = /CORS_ORIGIN/.test(e?.message ?? '');
    }
    check(corsRefused, 'production boot with CORS_ORIGIN="*" is refused');
    process.env.CORS_ORIGIN = badCors;

    // Fase 3.8.1 — a known development token is never production authentication.
    const strongToken = process.env.ADMIN_TOKEN;
    process.env.ADMIN_TOKEN = 'ilmnet-admin-dev-2026';
    let devTokenRefused = '';
    try {
      await buildApp();
    } catch (e: any) {
      devTokenRefused = e?.message ?? '';
    }
    check(
      /\.env file may not configure a production boot|must never authenticate a production deployment/i.test(devTokenRefused),
      `production boot with a known dev token is refused (${devTokenRefused.slice(0, 60)}…)`,
    );

    process.env.ADMIN_TOKEN = 'short';
    let shortTokenRefused = '';
    try {
      await buildApp();
    } catch (e: any) {
      shortTokenRefused = e?.message ?? '';
    }
    check(/too short for production/i.test(shortTokenRefused), 'production boot with a too-short token is refused');
    process.env.ADMIN_TOKEN = strongToken;

    const probe = Fastify();
    const headers = await new Promise<Record<string, any>>((resolve) => {
      probe.get('/x', async (_req, reply) => reply.send({ ok: true }));
      probe.ready().then(() =>
        probe.inject({ method: 'GET', url: '/x' }).then((r) => resolve(r.headers as Record<string, any>)),
      );
    });
    check(typeof headers === 'object', 'sanitised probe app responds (sanity)');
    await probe.close();

    const secHeaders = await fetch(`${base}/api/health`);
    check(secHeaders.headers.get('x-content-type-options') === 'nosniff', 'API responses set X-Content-Type-Options: nosniff');
    check(Boolean(secHeaders.headers.get('referrer-policy')), 'API responses set a referrer policy');

    console.log('\n--- 6b. TLS / HTTPS readiness + proxy trust (Fase 5.1 / 5.2) ---');
  // (1) Default: trust nothing. A client cannot claim to speak HTTPS.
  {
    const saved = process.env.TRUST_PROXY;
    delete process.env.TRUST_PROXY;
    const plainApp = await buildApp();
    const plainBase = await plainApp.listen({ port: 0, host: '127.0.0.1' });
    try {
      check(
        trustProxyIsEnabled() === false,
        `TRUST_PROXY unset means nothing is trusted (${JSON.stringify(trustProxySetting())})`,
      );
      const spoofedProto = await fetch(`${plainBase}/api/health`, {
        headers: { host: 'ilmnet.example', 'x-forwarded-proto': 'https' },
      });
      check(
        spoofedProto.headers.get('strict-transport-security') === null,
        'x-forwarded-proto is ignored while TRUST_PROXY is unset (no HSTS from a spoofed header)',
      );
      const spoofedFor = await fetch(`${plainBase}/api/health`, {
        headers: { host: 'ilmnet.example', 'x-forwarded-for': '203.0.113.9' },
      });
      check(spoofedFor.status === 200, 'a spoofed x-forwarded-for does not break the request');
    } finally {
      await plainApp.close();
      restoreEnv('TRUST_PROXY', saved);
    }
  }

  // (2) Behind a trusted proxy: HSTS exactly on requests that arrive over HTTPS.
  const savedTrustProxy = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = 'true';
  const tlsApp = await buildApp();
  const tlsBase = await tlsApp.listen({ port: 0, host: '127.0.0.1' });
  try {
    const secureReq = await fetch(`${tlsBase}/api/health`, {
      headers: { host: 'ilmnet.example', 'x-forwarded-proto': 'https' },
    });
    const hsts = secureReq.headers.get('strict-transport-security') ?? '';
    check(hsts.includes('max-age='), `https request through a trusted proxy carries HSTS (${hsts || 'missing'})`);
    check(!/includeSubDomains/i.test(hsts), 'HSTS does not claim includeSubDomains before the subdomains are ready');
    check(
      secureReq.headers.get('referrer-policy') === 'strict-origin-when-cross-origin',
      'referrer policy stays the YouTube-compatible value (Fase 4.3.1)',
    );

    const plainReq = await fetch(`${tlsBase}/api/health`, { headers: { host: 'ilmnet.example' } });
    check(plainReq.headers.get('strict-transport-security') === null, 'plain http response carries no HSTS header');

    const savedHsts = process.env.HSTS_MAX_AGE;
    process.env.HSTS_MAX_AGE = '0';
    const hstsDisabled = await fetch(`${tlsBase}/api/health`, {
      headers: { host: 'ilmnet.example', 'x-forwarded-proto': 'https' },
    });
    check(hstsDisabled.headers.get('strict-transport-security') === null, 'HSTS_MAX_AGE=0 switches HSTS off');
    restoreEnv('HSTS_MAX_AGE', savedHsts);
  } finally {
    await tlsApp.close();
    restoreEnv('TRUST_PROXY', savedTrustProxy);
  }

  // (3) FORCE_HTTPS: 308 keeps method + body, probes keep working, and the target is never taken
  //     from an untrusted host.
  const savedForceHttps = process.env.FORCE_HTTPS;
  process.env.FORCE_HTTPS = 'true';
  process.env.TRUST_PROXY = 'true';
  const redirectApp = await buildApp();
  const redirectBase = await redirectApp.listen({ port: 0, host: '127.0.0.1' });
  try {
    // `fetch` cannot override the Host header, so the proxy-supplied public host is tested the way a
    // real proxy supplies it: through x-forwarded-host.
    const httpGet = await fetch(`${redirectBase}/lectures?type=audio`, {
      headers: { host: 'ilmnet.example', 'x-forwarded-host': 'ilmnet.example' },
      redirect: 'manual',
    });
    check(httpGet.status === 308, `FORCE_HTTPS answers plain http with 308 (${httpGet.status})`);
    check(
      (httpGet.headers.get('location') ?? '') === 'https://ilmnet.example/lectures?type=audio',
      `redirect uses the forwarded host and keeps path + query (${httpGet.headers.get('location')})`,
    );

    // A host outside the allowlist is replaced by the canonical origin, never echoed back.
    const notAllowed = await fetch(`${redirectBase}/books`, {
      headers: { host: '10.1.2.3:8080', 'x-forwarded-host': '10.1.2.3' },
      redirect: 'manual',
    });
    check(
      (notAllowed.headers.get('location') ?? '') === 'https://ilmnet.example/books',
      `a host outside the allowlist is replaced by the canonical origin (${notAllowed.headers.get('location')})`,
    );

    // A forged forwarded host must never become the redirect target (open-redirect guard).
    const forgedHost = await fetch(`${redirectBase}/lectures`, {
      headers: { host: 'ilmnet.example', 'x-forwarded-host': 'evil.example' },
      redirect: 'manual',
    });
    const forgedLocation = forgedHost.headers.get('location') ?? '';
    check(
      forgedHost.status === 308 && forgedLocation.startsWith('https://ilmnet.example/'),
      `a forged x-forwarded-host is not echoed back (${forgedLocation})`,
    );
    check(!forgedLocation.includes('evil.example'), 'the forged host never appears in the redirect');

    // An allowlisted host is honoured as-is — that is what ALLOWED_HOSTS is for.
    const savedAllowed = process.env.ALLOWED_HOSTS;
    process.env.ALLOWED_HOSTS = 'intranet.example';
    const allowApp = await buildApp();
    const allowBase = await allowApp.listen({ port: 0, host: '127.0.0.1' });
    try {
      const allowedHost = await fetch(`${allowBase}/scholars?page=2`, {
        headers: { host: 'ilmnet.example', 'x-forwarded-host': 'intranet.example' },
        redirect: 'manual',
      });
      check(
        (allowedHost.headers.get('location') ?? '') === 'https://intranet.example/scholars?page=2',
        `an allowlisted host is used as the redirect target (${allowedHost.headers.get('location')})`,
      );
    } finally {
      await allowApp.close();
      restoreEnv('ALLOWED_HOSTS', savedAllowed);
    }

    const httpsGet = await fetch(`${redirectBase}/lectures`, {
      headers: { host: 'ilmnet.example', 'x-forwarded-proto': 'https' },
      redirect: 'manual',
    });
    check(httpsGet.status === 200, `https request is served, not redirected (${httpsGet.status})`);

    for (const probe of ['/api/health', '/api/v1/health', '/api/ready', '/api/v1/ready']) {
      const overHttp = await fetch(`${redirectBase}${probe}`, {
        headers: { host: 'ilmnet.example' },
        redirect: 'manual',
      });
      check(overHttp.status === 200, `${probe} stays reachable over plain http for a probe (${overHttp.status})`);
    }

    // PUBLIC_ORIGIN wins over everything else, so the redirect cannot be steered at all.
    const savedPublicOrigin = process.env.PUBLIC_ORIGIN;
    process.env.PUBLIC_ORIGIN = 'https://canonical.example';
    const canonicalApp = await buildApp();
    const canonicalBase = await canonicalApp.listen({ port: 0, host: '127.0.0.1' });
    try {
      const canonicalRedirect = await fetch(`${canonicalBase}/books?page=2`, {
        headers: { host: 'ilmnet.example', 'x-forwarded-host': 'ilmnet.example' },
        redirect: 'manual',
      });
      check(
        (canonicalRedirect.headers.get('location') ?? '') === 'https://canonical.example/books?page=2',
        `PUBLIC_ORIGIN decides the redirect target (${canonicalRedirect.headers.get('location')})`,
      );
    } finally {
      await canonicalApp.close();
      restoreEnv('PUBLIC_ORIGIN', savedPublicOrigin);
    }
  } finally {
    await redirectApp.close();
    restoreEnv('FORCE_HTTPS', savedForceHttps);
    restoreEnv('TRUST_PROXY', savedTrustProxy);
  }

  console.log('\n--- 6c. Proxy configuration guard rails (Fase 5.2) ---');
  check(trustProxySetting() === false, 'TRUST_PROXY unset → false (trust nothing)');
  process.env.TRUST_PROXY = '127.0.0.1,10.0.0.0/8';
  const parsedList = trustProxySetting();
  check(
    Array.isArray(parsedList) && parsedList.length === 2 && parsedList[1] === '10.0.0.0/8',
    `TRUST_PROXY accepts an explicit proxy list (${JSON.stringify(parsedList)})`,
  );
  const listApp = await buildApp();
  check(listApp.initialConfig !== undefined, 'an app with an explicit proxy list builds');
  await listApp.close();

  // A hop count would silently trust the wrong hop — refused, in any mode.
  process.env.TRUST_PROXY = '2';
  let hopCountRefused = '';
  try {
    await buildApp();
  } catch (e: any) {
    hopCountRefused = e?.message ?? '';
  }
  check(/hop count/.test(hopCountRefused), `TRUST_PROXY="2" is refused (${hopCountRefused.slice(0, 44)}…)`);

  // `process.env.X = undefined` stores the string "undefined" — never a proxy address.
  process.env.TRUST_PROXY = 'undefined';
  check(trustProxySetting() === false, 'the literal string "undefined" is treated as unset');
  restoreEnv('TRUST_PROXY', savedTrustProxy);

  // FORCE_HTTPS without a trusted proxy would redirect every request to itself: refused at boot.
  process.env.FORCE_HTTPS = 'true';
  process.env.TRUST_PROXY = '';
  let loopRefused = '';
  try {
    await buildApp();
  } catch (e: any) {
    loopRefused = e?.message ?? '';
  }
  check(/requires TRUST_PROXY/.test(loopRefused), `FORCE_HTTPS without TRUST_PROXY is refused (${loopRefused.slice(0, 44)}…)`);

  // ... and with a trusted proxy but no allowlisted host, the redirect target is missing: refused.
  process.env.TRUST_PROXY = 'true';
  const savedCorsForProxy = process.env.CORS_ORIGIN;
  const savedPublicForProxy = process.env.PUBLIC_ORIGIN;
  const savedAllowedForProxy = process.env.ALLOWED_HOSTS;
  // Not `delete`: then the value would come from server/.env and rule R3 rightly refuses the boot
  // before this guard is even reached. An empty process value is authoritative and host-less.
  process.env.CORS_ORIGIN = '';
  delete process.env.PUBLIC_ORIGIN;
  delete process.env.ALLOWED_HOSTS;
  let targetRefused = '';
  try {
    await buildApp();
  } catch (e: any) {
    targetRefused = e?.message ?? '';
  }
  check(
    /needs a redirect target/.test(targetRefused),
    `FORCE_HTTPS without PUBLIC_ORIGIN/CORS_ORIGIN is refused (${targetRefused.slice(0, 44)}…)`,
  );
  restoreEnv('CORS_ORIGIN', savedCorsForProxy);
  restoreEnv('PUBLIC_ORIGIN', savedPublicForProxy);
  restoreEnv('ALLOWED_HOSTS', savedAllowedForProxy);
  restoreEnv('FORCE_HTTPS', savedForceHttps);
  restoreEnv('TRUST_PROXY', savedTrustProxy);

  console.log('\n--- 6d. Readiness probe (Fase 5.2) ---');
  const ready = await fetch(`${base}/api/ready`);
  const readyJson: any = await ready.json().catch(() => ({}));
  check(
    ready.status === 200 && readyJson.status === 'ready',
    `GET /api/ready is 200 + ready (${ready.status} ${readyJson.status})`,
  );
  check(readyJson.database === 'up', 'readiness reports the database as up');
  const readyV1 = await fetch(`${base}/api/v1/ready`);
  check(readyV1.status === 200, `GET /api/v1/ready mirrors it (${readyV1.status})`);
  const readyNoAuth = await raw('GET', `${base}/api/ready`);
  check(readyNoAuth.status === 200, `readiness needs no credentials (${readyNoAuth.status})`);
  const readyShape = Object.keys(readyJson).sort().join(',');
  check(
    readyShape === 'database,service,status,timestamp',
    `readiness stays a cheap probe, not the deep health payload (${readyShape})`,
  );

  console.log('\n--- 6e. Data & security hardening (Fase 5.3) ---');
  {
    const stamp = Date.now().toString(36);
    const account = `prod-53-${stamp}`;
    const password = `prod-53-suite-password-${stamp}`;
    const fixtureTitle = `Fase 5.3 payload fixture ${stamp}`;
    const draftTitle = `Fase 5.3 draft fixture ${stamp}`;
    const user = await prisma.adminUser.create({
      data: { username: account, passwordHash: await hashPassword(password), role: 'admin' },
    });
    let scholarId: string | null = null;
    let subjectId: string | null = null;
    const contentIds: string[] = [];
    try {
      // ── A real operator session, while the legacy token path is switched off ──
      const savedLegacy = process.env.ADMIN_LEGACY_TOKEN;
      process.env.ADMIN_LEGACY_TOKEN = 'false';
      const noLegacyApp = await buildApp();
      const noLegacyBase = await noLegacyApp.listen({ port: 0, host: '127.0.0.1' });
      try {
        const withToken = await fetch(`${noLegacyBase}/api/admin/contents`, {
          headers: { host: 'ilmnet.example', 'x-admin-token': TOKEN },
        });
        check(
          withToken.status === 401,
          `with ADMIN_LEGACY_TOKEN=false the shared token is refused (${withToken.status})`,
        );
        const healthNoLegacy = await fetch(`${noLegacyBase}/api/health`, { headers: { host: 'ilmnet.example' } });
        const healthJson: any = await healthNoLegacy.json().catch(() => ({}));
        check(healthJson.adminProtection === 'sessions', `health reports sessions-only (${healthJson.adminProtection})`);

        const login = await fetch(`${noLegacyBase}/api/admin/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', host: 'ilmnet.example' },
          body: JSON.stringify({ username: account, password }),
        });
        const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
        check(login.status === 200 && cookie.startsWith('ilmnet_admin_session='), `a real account can still sign in (${login.status})`);

        // ── Fixtures through the session: createdBy is a real operator name ──
        const sessionHeaders = { 'content-type': 'application/json', host: 'ilmnet.example', cookie };
        const scholarRes = await fetch(`${noLegacyBase}/api/admin/scholars`, {
          method: 'POST',
          headers: sessionHeaders,
          body: JSON.stringify({ name: `Payload Scholar ${stamp}` }),
        });
        scholarId = (await scholarRes.json().catch(() => ({})))?.data?.id ?? null;
        const subjectRes = await fetch(`${noLegacyBase}/api/admin/subjects`, {
          method: 'POST',
          headers: sessionHeaders,
          body: JSON.stringify({ name: `Payload Subject ${stamp}`, group: 'Belief' }),
        });
        subjectId = (await subjectRes.json().catch(() => ({})))?.data?.id ?? null;
        check(Boolean(scholarId && subjectId), 'session writes create the fixture scholar + subject');

        const collectionId = `fase54-collection-${stamp}`;
        const baseContent = {
          type: 'audio',
          provider: 'archive',
          sourceUrl: `https://archive.org/details/fase53-${stamp}`,
          externalIdentifier: `fase53-${stamp}`,
          scholarIds: scholarId ? [scholarId] : [],
          subjectIds: subjectId ? [subjectId] : [],
          collectionIdentifier: collectionId,
          collectionTitle: `Fase 5.4 collection ${stamp}`,
          // Fase 5.4: provider metadata that the cards render only as a thumbnail, plus fields that
          // must stay out of a *list* response (tags/publisher/isbn are detail-page data).
          metadata: {
            archive: { thumbnail: 'https://archive.org/services/img/fase54-fixture', available_media: ['VBR MP3'] },
            tags: ['fase54-tag'],
            publisher: 'Fase 5.4 Publisher',
            isbn: '978-0000000000',
          },
        };
        const publishedRes = await fetch(`${noLegacyBase}/api/admin/contents`, {
          method: 'POST',
          headers: sessionHeaders,
          body: JSON.stringify({ ...baseContent, title: fixtureTitle, status: 'published' }),
        });
        const published = (await publishedRes.json().catch(() => ({})))?.data;
        const draftRes = await fetch(`${noLegacyBase}/api/admin/contents`, {
          method: 'POST',
          headers: sessionHeaders,
          body: JSON.stringify({ ...baseContent, title: draftTitle, externalIdentifier: `fase53-draft-${stamp}` }),
        });
        const draft = (await draftRes.json().catch(() => ({})))?.data;
        check(
          publishedRes.status === 201 && draftRes.status === 201 && published?.createdBy === account,
          `session writes are attributed to the operator (createdBy=${published?.createdBy})`,
        );
        if (published?.id) contentIds.push(published.id);
        if (draft?.id) contentIds.push(draft.id);

        // ── Public payload: positive list, no operator attribution, no import bookkeeping ──
        const listRes = await fetch(`${noLegacyBase}/api/contents?q=${encodeURIComponent(fixtureTitle)}&limit=5`);
        const listJson: any = await listRes.json();
        const row = listJson?.data?.[0];
        const expectedKeys = [...PUBLIC_CONTENT_KEYS].sort().join(',');
        check(published?.id === row?.id && listJson?.data?.length === 1, 'the public list returns the published fixture');
        check(
          Object.keys(row ?? {}).sort().join(',') === expectedKeys,
          `the public content payload carries exactly the public fields (${Object.keys(row ?? {}).sort().join(',')})`,
        );
        const leaked = findKeysDeep(row, INTERNAL_CONTENT_KEYS as unknown as string[]);
        check(leaked.length === 0, `no internal field leaks in the public list payload (${leaked.join(', ') || 'none'})`);
        check(
          row?.scholars?.[0]?.scholar?.metadata === undefined && row?.subjects?.[0]?.subject?.metadata === undefined,
          'nested scholar/subject metadata stays server-side',
        );
        // Fase 5.4: a *list* carries only the media keys of `metadata` and card-shaped join rows; the
        // detail payload keeps the full public shape (tags/publisher/ISBN are detail-page data).
        check(
          row?.metadata?.archive?.thumbnail === 'https://archive.org/services/img/fase54-fixture' &&
            row?.metadata?.tags === undefined &&
            row?.metadata?.publisher === undefined,
          'a list item keeps only the provider media keys of metadata',
        );
        check(
          row?.scholars?.[0]?.scholar?.name === `Payload Scholar ${stamp}` &&
            row?.scholars?.[0]?.scholar?.bio === undefined &&
            Object.keys(row?.scholars?.[0]?.scholar ?? {}).every((k: string) => LIST_JOIN_SCHOLAR_KEYS.includes(k as any)),
          'a list item carries card-shaped nested scholars (name/slug/accent, no bio)',
        );
        const listBytes = JSON.stringify(listJson).length;

        // Fase 5.4: exact collection filter — indexed equality instead of a nine-column ILIKE search.
        const collectionRes = await fetch(`${noLegacyBase}/api/contents?limit=100&collection=${encodeURIComponent(collectionId)}`);
        const collectionJson: any = await collectionRes.json();
        check(
          collectionRes.status === 200 &&
            collectionJson.data.length === 1 &&
            collectionJson.data[0].id === published?.id &&
            collectionJson.pagination.total === 1,
          'collection=<identifier> returns exactly that collection (index-backed equality)',
        );
        const unrelated = await fetch(`${noLegacyBase}/api/contents?limit=5&collection=fase54-nothing-${stamp}`);
        check((await unrelated.json())?.pagination?.total === 0, 'an unknown collection returns an empty, honest total');

        const detailRes = await fetch(`${noLegacyBase}/api/contents/${encodeURIComponent(published?.slug ?? '')}`);
        const detailJson: any = await detailRes.json();
        check(
          detailRes.status === 200 && findKeysDeep(detailJson?.data, INTERNAL_CONTENT_KEYS as unknown as string[]).length === 0,
          'the public detail payload leaks no internal field either',
        );
        check(
          detailJson?.data?.metadata?.publisher === 'Fase 5.4 Publisher' && detailJson?.data?.metadata?.isbn === '978-0000000000',
          'the detail payload still carries the full provider metadata',
        );
        const detailBytes = JSON.stringify(detailJson).length;
        check(
          listBytes < detailBytes,
          `a list item is smaller than a detail item (list ${listBytes} B vs detail ${detailBytes} B)`,
        );

        // The admin payload keeps attribution — the CMS shows it.
        const adminRow = await fetch(`${noLegacyBase}/api/admin/contents/${published?.id}`, {
          headers: { host: 'ilmnet.example', cookie },
        });
        const adminJson: any = await adminRow.json();
        check(
          adminJson?.data?.createdBy === account && adminJson?.data?.updatedBy === account,
          'the admin payload still carries createdBy/updatedBy (the CMS needs attribution)',
        );

        // ── A scholar page must not show drafts ──
        const scholarDetail = await fetch(`${noLegacyBase}/api/scholars/${encodeURIComponent(scholarId ?? '')}`);
        const scholarJson: any = await scholarDetail.json();
        const linked = scholarJson?.data?.contents ?? [];
        check(
          linked.length === 1 && linked.every((j: any) => j?.content?.status === 'published'),
          `the public scholar page lists only published content (${linked.length} linked, ${linked.map((j: any) => j?.content?.status).join('/') || 'none'})`,
        );
        check(
          linked.every((j: any) => findKeysDeep(j?.content, INTERNAL_CONTENT_KEYS as unknown as string[]).length === 0),
          'linked content on a scholar page carries no internal fields',
        );
        const publicSubjects = await fetch(`${noLegacyBase}/api/subjects`);
        const subjectsJson: any = await publicSubjects.json();
        check(
          Array.isArray(subjectsJson?.data) && subjectsJson.data.every((s: any) => s.metadata === undefined),
          'public subjects never expose their metadata',
        );

        // ── Destructive actions need a record-specific confirmation ──
        const unconfirmed = await fetch(`${noLegacyBase}/api/admin/contents/${published?.id}?hard=true`, {
          method: 'DELETE',
          headers: { host: 'ilmnet.example', cookie },
        });
        const unconfirmedJson: any = await unconfirmed.json().catch(() => ({}));
        const stillThere = await prisma.content.findUnique({ where: { id: published?.id } });
        check(
          unconfirmed.status === 400 && unconfirmedJson?.error?.code === 'CONFIRM_REQUIRED' && Boolean(stillThere),
          `hard delete without confirmation is refused and changes nothing (${unconfirmed.status} ${unconfirmedJson?.error?.code})`,
        );
        const wrongConfirm = await fetch(`${noLegacyBase}/api/admin/contents/${published?.id}?hard=true&confirm=not-this-one`, {
          method: 'DELETE',
          headers: { host: 'ilmnet.example', cookie },
        });
        check(wrongConfirm.status === 400, `hard delete with a wrong confirmation is refused (${wrongConfirm.status})`);

        // The reversible path (archive) is the default and needs no confirmation.
        const archived = await fetch(`${noLegacyBase}/api/admin/contents/${draft?.id}`, {
          method: 'DELETE',
          headers: { host: 'ilmnet.example', cookie },
        });
        const archivedRow = await prisma.content.findUnique({ where: { id: draft?.id } });
        check(
          archived.status === 200 && archivedRow?.status === 'archived',
          `DELETE without hard=true archives the record instead of deleting it (${archivedRow?.status})`,
        );

        const confirmed = await fetch(
          `${noLegacyBase}/api/admin/contents/${published?.id}?hard=true&confirm=${encodeURIComponent(published?.slug ?? '')}`,
          { method: 'DELETE', headers: { host: 'ilmnet.example', cookie } },
        );
        const gone = await prisma.content.findUnique({ where: { id: published?.id } });
        check(confirmed.status === 200 && gone === null, `a confirmed hard delete removes the record (${confirmed.status})`);

        // A linked scholar/subject is refused outright — the guard runs before any confirmation.
        const scholarLinked = await fetch(`${noLegacyBase}/api/admin/scholars/${scholarId}?confirm=${encodeURIComponent(scholarId ?? '')}`, {
          method: 'DELETE',
          headers: { host: 'ilmnet.example', cookie },
        });
        check(scholarLinked.status === 409, `a scholar that is still linked to content is refused (${scholarLinked.status})`);
        const subjectLinked = await fetch(`${noLegacyBase}/api/admin/subjects/${subjectId}?confirm=${encodeURIComponent(subjectId ?? '')}`, {
          method: 'DELETE',
          headers: { host: 'ilmnet.example', cookie },
        });
        check(subjectLinked.status === 409, `a subject that is still linked to content is refused (${subjectLinked.status})`);

        // Unlink the fixtures (the draft is archived, not deleted), then require a confirmation.
        await prisma.contentSubject.deleteMany({ where: { subjectId: subjectId ?? '' } });
        await prisma.contentScholar.deleteMany({ where: { scholarId: scholarId ?? '' } });
        const scholarUnconfirmed = await fetch(`${noLegacyBase}/api/admin/scholars/${scholarId}`, {
          method: 'DELETE',
          headers: { host: 'ilmnet.example', cookie },
        });
        check(scholarUnconfirmed.status === 400, `deleting an unlinked scholar without confirmation is refused (${scholarUnconfirmed.status})`);
        const subjectUnconfirmed = await fetch(`${noLegacyBase}/api/admin/subjects/${subjectId}`, {
          method: 'DELETE',
          headers: { host: 'ilmnet.example', cookie },
        });
        check(subjectUnconfirmed.status === 400, `deleting an unlinked subject without confirmation is refused (${subjectUnconfirmed.status})`);
        const scholarDeleted = await fetch(`${noLegacyBase}/api/admin/scholars/${scholarId}?confirm=${encodeURIComponent(scholarId ?? '')}`, {
          method: 'DELETE',
          headers: { host: 'ilmnet.example', cookie },
        });
        const subjectDeleted = await fetch(`${noLegacyBase}/api/admin/subjects/${subjectId}?confirm=${encodeURIComponent(subjectId ?? '')}`, {
          method: 'DELETE',
          headers: { host: 'ilmnet.example', cookie },
        });
        check(
          scholarDeleted.status === 200 && subjectDeleted.status === 200,
          `confirmed deletions of scholar/subject succeed (${scholarDeleted.status}/${subjectDeleted.status})`,
        );
        scholarId = null;
        subjectId = null;
      } finally {
        restoreEnv('ADMIN_LEGACY_TOKEN', savedLegacy);
        await noLegacyApp.close();
      }

      // ── The boot rule that protects a sessions-only deployment ──
      let noWayIn = '';
      try {
        assertAdminAccessPossible({ mode: 'production', legacyTokenEnabled: false, activeAccounts: 0 });
      } catch (e: any) {
        noWayIn = e?.message ?? '';
      }
      check(/No way in/.test(noWayIn), 'a production boot without accounts and without the token is refused');
      let withAccount = '';
      try {
        assertAdminAccessPossible({ mode: 'production', legacyTokenEnabled: false, activeAccounts: 1 });
      } catch (e: any) {
        withAccount = e?.message ?? '';
      }
      check(withAccount === '', 'the same rule accepts a deployment that has an active account');
      check(
        legacyAdminTokenEnabled() === true && adminAuthPosture() === 'sessions+legacy-token',
        'the running suite host has the legacy token enabled explicitly (ADMIN_LEGACY_TOKEN=true)',
      );
    } finally {
      // Fixtures always leave: content first (join rows cascade), then the reference data and account.
      await prisma.content.deleteMany({ where: { id: { in: contentIds } } }).catch(() => {});
      await prisma.content.deleteMany({ where: { title: { startsWith: 'Fase 5.3 ' } } }).catch(() => {});
      if (scholarId) await prisma.scholar.delete({ where: { id: scholarId } }).catch(() => {});
      if (subjectId) await prisma.subject.delete({ where: { id: subjectId } }).catch(() => {});
      await prisma.adminUser.deleteMany({ where: { username: account } }).catch(() => {});
    }
  }

  console.log('\n--- 7. Frontend hosting + JSON 404s ---');
    const buildIndex = path.resolve(process.cwd(), '..', 'dist', 'index.html');
    if (fs.existsSync(buildIndex)) {
      const root = await fetch(`${base}/`);
      const rootHtml = await root.text();
      check(root.status === 200 && rootHtml.includes('<div id="root"'), 'GET / serves the built frontend');

      const deepLink = await fetch(`${base}/lectures`);
      const deepHtml = await deepLink.text();
      check(deepLink.status === 200 && deepHtml.includes('<div id="root"'), 'deep link /lectures falls back to index.html (refresh-safe)');

      const missingApi = await raw('GET', `${base}/api/does-not-exist`);
      check(missingApi.status === 404 && missingApi.json?.error?.code === 'NOT_FOUND', 'unknown API route still returns JSON 404');

      // Fase 5.4: the single-file bundle is served pre-compressed when the client supports gzip, and
      // a deep link goes through the static handler (sendFile) instead of a synchronous readFileSync.
      const gzRoot = await fetch(`${base}/`, { headers: { 'accept-encoding': 'gzip' } });
      const gzDeep = await fetch(`${base}/lectures`, { headers: { 'accept-encoding': 'gzip' } });
      const identity = await fetch(`${base}/lectures`, { headers: { 'accept-encoding': 'identity' } });
      const hasGzVariant = fs.existsSync(`${buildIndex}.gz`);
      check(
        hasGzVariant
          ? gzRoot.headers.get('content-encoding') === 'gzip' && gzDeep.headers.get('content-encoding') === 'gzip'
          : true,
        `the gzip build is served compressed when the client asks for it (index.html.gz ${hasGzVariant ? 'present' : 'absent'})`,
      );
      check(
        identity.headers.get('content-encoding') === null && (await identity.text()).includes('<div id="root"'),
        'a client without gzip support still receives the full uncompressed app',
      );
      // Conditional request → 304. Note: `fetch` (undici) drops `if-none-match` on the way out, so this
      // one check talks HTTP directly — curl and node:http both get the 304 the browser would get.
      const etag = gzDeep.headers.get('etag');
      const conditionalStatus = await new Promise<number>((resolve) => {
        const req = httpRequest(
          { host: '127.0.0.1', port: Number(new URL(base).port), path: '/lectures', method: 'GET', headers: { 'accept-encoding': 'gzip', 'if-none-match': etag ?? '' } },
          (res) => {
            res.resume();
            resolve(res.statusCode ?? 0);
          },
        );
        req.on('error', () => resolve(-1));
        req.end();
      });
      check(conditionalStatus === 304, `the SPA fallback answers a conditional request with 304 (got ${conditionalStatus}, etag ${etag ?? 'none'})`);
    } else {
      fail('frontend build missing — run `npm run build` in the repo root first');
    }

  // ── 9. Crawler surface + security headers (Fase 5.5) ──
  console.log('\n--- 9. robots.txt / sitemap.xml / 404s / headers (Fase 5.5) ---');
  const savedPublicOrigin = process.env.PUBLIC_ORIGIN;
  process.env.PUBLIC_ORIGIN = 'https://ilmnet.example';
  resetSeoCache();
  try {
    const published = await prisma.content.findFirst({
      where: { status: 'published' },
      select: { slug: true, type: true, status: true },
    });
    const publishedSubject = await prisma.subject.findFirst({ where: { status: 'published' }, select: { slug: true } });

    const robots = await fetch(`${base}/robots.txt`);
    const robotsText = await robots.text();
    check(robots.status === 200 && /text\/plain/.test(robots.headers.get('content-type') ?? ''), `GET /robots.txt is plain text (${robots.status})`);
    check(/Disallow: \/admin/.test(robotsText), 'robots.txt keeps crawlers out of the CMS');
    check(
      robotsText.includes('Sitemap: https://ilmnet.example/sitemap.xml'),
      'robots.txt points at the canonical (PUBLIC_ORIGIN) sitemap — never at a host from the request',
    );

    const sitemap = await fetch(`${base}/sitemap.xml`);
    const sitemapXml = await sitemap.text();
    check(
      sitemap.status === 200 && /application\/xml/.test(sitemap.headers.get('content-type') ?? ''),
      `GET /sitemap.xml is XML (${sitemap.status}, ${sitemap.headers.get('content-type')})`,
    );
    check(sitemapXml.includes('<loc>https://ilmnet.example/</loc>'), 'the sitemap lists the landing page on the canonical origin');
    check(
      ['/lectures', '/books', '/scholars', '/subjects'].every((p) => sitemapXml.includes(`<loc>https://ilmnet.example${p}</loc>`)),
      'the sitemap lists the five public sections',
    );
    if (published) {
      const section = published.type === 'book' || published.type === 'document' ? 'books' : 'lectures';
      check(
        sitemapXml.includes(`<loc>https://ilmnet.example/${section}/${published.slug}</loc>`),
        `a published item is listed at its canonical path (/…/${section}/${published.slug})`,
      );
    } else {
      fail('no published content available to verify the sitemap');
    }
    if (publishedSubject) {
      check(
        sitemapXml.includes(`<loc>https://ilmnet.example/subjects/${publishedSubject.slug}</loc>`),
        'published subjects are listed',
      );
    }
    check(!sitemapXml.includes(draft.slug), 'the draft probe from section 3 is absent from the sitemap');
    check(
      (sitemapXml.match(/<loc>/g) ?? []).length === (sitemapXml.match(/<\/loc>/g) ?? []).length,
      'every <loc> is closed (well-formed enough for a crawler)',
    );
    check(
      !/<loc>(?!https:\/\/ilmnet\.example)/.test(sitemapXml),
      'every sitemap URL is absolute and on the canonical origin',
    );

    // `fetch` (undici) decompresses a gzip response itself and drops the header, so the compressed
    // variant is measured with a raw HTTP request — the same trick as the 304 check above.
    const gzRaw = await new Promise<{ status: number; encoding: string | undefined; vary: string | undefined; body: Buffer }>((resolve) => {
      const req = httpRequest(
        { host: '127.0.0.1', port: Number(new URL(base).port), path: '/sitemap.xml', method: 'GET', headers: { 'accept-encoding': 'gzip' } },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(Buffer.from(c)));
          res.on('end', () =>
            resolve({
              status: res.statusCode ?? 0,
              encoding: res.headers['content-encoding'] as string | undefined,
              vary: res.headers.vary as string | undefined,
              body: Buffer.concat(chunks),
            }),
          );
        },
      );
      req.on('error', () => resolve({ status: -1, encoding: undefined, vary: undefined, body: Buffer.alloc(0) }));
      req.end();
    });
    let gzText = '';
    try {
      gzText = gzRaw.encoding === 'gzip' ? gunzipSync(gzRaw.body).toString('utf8') : '';
    } catch {
      gzText = '';
    }
    check(
      gzRaw.encoding === 'gzip' && gzText === sitemapXml,
      `the sitemap is gzipped for clients that ask for it (${gzRaw.body.length} B compressed vs ${sitemapXml.length} B plain)`,
    );
    check(gzRaw.vary?.includes('accept-encoding') === true, 'the sitemap sets Vary: accept-encoding');

    const sitemapAgain = await fetch(`${base}/sitemap.xml`);
    check((await sitemapAgain.text()) === sitemapXml, 'the sitemap is cached (identical body on the second request)');

    const unknownPage = await fetch(`${base}/this-page-does-not-exist`);
    const unknownHtml = await unknownPage.text();
    check(
      unknownPage.status === 200 && unknownHtml.includes('<div id="root"'),
      'an unknown *page* still gets the app shell (the client renders its own 404)',
    );
    for (const asset of ['/does-not-exist.png', '/robots-missing.txt', '/fonts/does-not-exist.woff2']) {
      const res = await fetch(`${base}${asset}`);
      const body = await res.json().catch(() => ({}));
      check(
        res.status === 404 && body?.error?.code === 'NOT_FOUND',
        `a missing file is a real 404 instead of index.html (${asset} → ${res.status})`,
      );
    }
    for (const asset of ['/favicon.svg', '/favicon.ico', '/apple-touch-icon.png', '/manifest.webmanifest', '/icon-512.png']) {
      const res = await fetch(`${base}${asset}`);
      check(res.status === 200, `the shipped icon/manifest set is served (${asset} → ${res.status})`);
    }

    const headers = await fetch(`${base}/`);
    const policy = headers.headers.get('permissions-policy') ?? '';
    check(policy.includes('camera=()') && policy.includes('geolocation=()'), 'Permissions-Policy switches off the unused capabilities');
    check(!policy.includes('fullscreen'), 'Permissions-Policy leaves fullscreen/video features to the embeds (delegated per iframe)');
    const csp = headers.headers.get('content-security-policy-report-only') ?? '';
    check(
      csp.includes("default-src 'self'") && csp.includes('frame-src https://www.youtube.com') && csp.includes("font-src 'self'"),
      'the report-only CSP describes the real dependencies (self-hosted fonts, embed frames)',
    );
    check(headers.headers.get('content-security-policy') === null, 'no enforcing CSP is sent (the single-file build would need unsafe-inline scripts)');
    check(
      headers.headers.get('x-frame-options') === null && csp.includes('frame-ancestors') === false,
      'framing is not restricted by the app itself (previews and embeds are allowed; the host decides)',
    );
    check(
      (headers.headers.get('referrer-policy') ?? '') === 'strict-origin-when-cross-origin',
      'the Referer policy YouTube requires (Fase 4.3.1) is unchanged',
    );

    // API JSON compression + per-file cache policy (both Fase 5.5). Measured with raw HTTP so the
    // header is visible (undici would decompress and hide it).
    const listPath = '/api/contents?limit=100';
    const listGz = await new Promise<{ status: number; encoding: string | undefined; vary: string | undefined; body: Buffer }>((resolve) => {
      const req = httpRequest(
        { host: '127.0.0.1', port: Number(new URL(base).port), path: listPath, method: 'GET', headers: { 'accept-encoding': 'gzip' } },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(Buffer.from(c)));
          res.on('end', () =>
            resolve({
              status: res.statusCode ?? 0,
              encoding: res.headers['content-encoding'] as string | undefined,
              vary: res.headers.vary as string | undefined,
              body: Buffer.concat(chunks),
            }),
          );
        },
      );
      req.on('error', () => resolve({ status: -1, encoding: undefined, vary: undefined, body: Buffer.alloc(0) }));
      req.end();
    });
    const listPlain = await fetch(`${base}${listPath}`, { headers: { 'accept-encoding': 'identity' } });
    const listPlainBody = await listPlain.text();
    let listGzText = '';
    try {
      listGzText = listGz.encoding === 'gzip' ? gunzipSync(listGz.body).toString('utf8') : '';
    } catch {
      listGzText = '';
    }
    check(
      listGz.encoding === 'gzip' && listGzText.length > 0,
      `public JSON lists are gzipped for clients that accept it (${listGz.body.length} B on the wire vs ${listPlainBody.length} B uncompressed)`,
    );
    check(listGzText === listPlainBody, 'the compressed and uncompressed list responses carry the same body');
    check(listGz.vary?.includes('accept-encoding') === true, 'the compressed list response announces Vary: accept-encoding');
    const smallJson = await new Promise<{ encoding: string | undefined }>((resolve) => {
      const req = httpRequest(
        { host: '127.0.0.1', port: Number(new URL(base).port), path: '/api/health', method: 'GET', headers: { 'accept-encoding': 'gzip' } },
        (res) => {
          res.resume();
          res.on('end', () => resolve({ encoding: res.headers['content-encoding'] as string | undefined }));
        },
      );
      req.on('error', () => resolve({ encoding: undefined }));
      req.end();
    });
    check(smallJson.encoding === undefined, 'a payload below the 1 kB threshold is sent uncompressed (no header overhead)');

    const cachedFont = await fetch(`${base}/fonts/inter-400-latin.woff2`, { method: 'GET' });
    check(
      (cachedFont.headers.get('cache-control') ?? '').includes('max-age=604800'),
      `self-hosted fonts are cached for a week instead of revalidated on every page (${cachedFont.headers.get('cache-control')})`,
    );
    const entryHtml = await fetch(`${base}/`);
    check(
      (entryHtml.headers.get('cache-control') ?? '').includes('max-age=0'),
      `index.html itself still revalidates on every load, so a deploy is visible immediately (got "${entryHtml.headers.get('cache-control')}" / ${entryHtml.status})`,
    );
  } finally {
    restoreEnv('PUBLIC_ORIGIN', savedPublicOrigin);
    resetSeoCache();
  }

  // ── 10. Operations: release identity + log level (Fase 5.6) ──
  console.log('\n--- 10. Release identity + LOG_LEVEL (Fase 5.6) ---');
  const pkgVersion: string = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8')).version;
  check(
    health.json.version === pkgVersion,
    `health reports the version from server/package.json (${health.json.version}) instead of a hard-coded string`,
  );
  check(
    health.json.commit === null,
    `without GIT_COMMIT the API reports commit:null instead of guessing (${JSON.stringify(health.json.commit)})`,
  );
  check(typeof health.json.uptime === 'number' && health.json.uptime >= 0, 'health reports the process uptime (operators can spot a restart)');

  const savedCommit = process.env.GIT_COMMIT;
  const savedLogLevel = process.env.LOG_LEVEL;
  try {
    // A second app instance plays the role of a host that exports its commit and a quieter log level.
    process.env.GIT_COMMIT = 'fase56test1234567890';
    process.env.LOG_LEVEL = 'warn';
    resetReleaseCache();
    const opsApp = await buildApp();
    const opsBase = await opsApp.listen({ port: 0, host: '127.0.0.1' });
    check(
      String((opsApp.log as any).level) === 'warn',
      `LOG_LEVEL=warn is applied to the logger (${String((opsApp.log as any).level)})`,
    );
    const opsHealth: any = await fetch(`${opsBase}/api/health`).then((r) => r.json());
    check(opsHealth.commit === 'fase56test1234567890', `GIT_COMMIT is reported by /api/health (${opsHealth.commit})`);

    // An invalid level must not change the verbosity silently, and must not stop the boot.
    process.env.LOG_LEVEL = 'chatty';
    const badApp = await buildApp();
    check(
      String((badApp.log as any).level) === 'info',
      `an unknown LOG_LEVEL falls back to the production default instead of being passed to pino (${String((badApp.log as any).level)})`,
    );
    await badApp.close();
    await opsApp.close();
  } finally {
    restoreEnv('GIT_COMMIT', savedCommit);
    restoreEnv('LOG_LEVEL', savedLogLevel);
    resetReleaseCache();
  }
  check(
    releaseInfo().commit === null,
    'release info is read fresh after an env change (no stale commit is cached across apps)',
  );
  } catch (e: any) {
    fail(`unexpected error: ${e?.stack ?? e?.message ?? e}`);
  } finally {
    for (const id of createdIds) {
      await prisma.content.delete({ where: { id } }).catch(() => {});
    }
    await app.close();
    await prisma.$disconnect();
  }

  console.log(`\n${failed === 0 ? '✅ All production readiness checks passed' : `❌ ${failed} checks failed`} (${passed} passed, ${failed} failed)`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
