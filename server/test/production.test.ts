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
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import Fastify from 'fastify';
import { buildApp } from '../src/server';
import { prisma } from '../src/lib/prisma';
import { getUploadsDir, listUploadFiles, uploadsHealth } from '../src/lib/storage';
import { trustProxyIsEnabled, trustProxySetting } from '../src/lib/proxy';

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

async function main() {
  const { app, base } = await prodApp();
  const createdIds: string[] = [];

  try {
    console.log('--- 1. Production health + admin protection ---');
    const health = await raw('GET', `${base}/api/health`);
    check(health.status === 200, `health is public (${health.status})`);
    check(health.json.database === 'up', 'health reports database up');
    check(health.json.storage?.writable === true, `health reports writable storage (${health.json.storage?.dir})`);
    check(health.json.adminProtection === true, 'health reports admin protection enabled');

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
      /ADMIN_TOKEN is required|\.env file may not configure a production boot/i.test(refuseMessage),
      `production boot without ADMIN_TOKEN is refused (${refuseMessage.slice(0, 60)}…)`,
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
    } else {
      fail('frontend build missing — run `npm run build` in the repo root first');
    }
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
