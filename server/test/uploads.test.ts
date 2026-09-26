/**
 * Fase 3.6 — custom thumbnail / cover uploads (real HTTP + real DB, no mocks)
 *
 * Covers:
 *  - POST /api/admin/uploads  (multipart, image only, 5 MB limit)
 *  - static serving of /uploads/<file>
 *  - GET/DELETE /api/admin/uploads
 *  - custom thumbnail persisted on Content and returned by the public API (priority over provider thumb)
 *  - provider thumbnails untouched for records without a custom image
 *  - Fase 5.3: the stored type is decided by the file's magic bytes, not by the multipart Content-Type
 */
import fs from 'fs';
import path from 'path';
import { buildApp } from '../src/server';
import { prisma } from '../src/lib/prisma';
import { UPLOADS_DIR } from '../src/routes/uploads';
import { announceEnvironment } from './env-banner';

const TOKEN = process.env.ADMIN_TOKEN || 'ilmnet-admin-dev-2026';
let passed = 0;
let failed = 0;

function ok(msg: string) {
  passed++;
  console.log(`✅ ${msg}`);
}
function fail(msg: string) {
  failed++;
  console.log(`❌ ${msg}`);
}
function check(cond: boolean, msg: string) {
  cond ? ok(msg) : fail(msg);
}

/** Minimal but real PNG (1x1, valid signature) */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

/** Bigger PNG-like blob for the size-limit test */
const BIG_BLOB = Buffer.concat([PNG_1PX, Buffer.alloc(6 * 1024 * 1024, 7)]);

/** A real JPEG (1x1, valid SOI/APP0/… structure) for the magic-byte check */
const JPEG_1PX = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64',
);

/** Bytes that claim to be a PNG but are an HTML document — the classic content-type lie */
const HTML_BYTES = Buffer.from('<!doctype html><html><body><script>alert(1)</script></body></html>');

function multipartBody(fieldName: string, filename: string, contentType: string, data: Buffer) {
  const boundary = '----ilmnetboundary' + Math.random().toString(36).slice(2);
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { body: Buffer.concat([head, data, tail]), boundary };
}

async function main() {
  announceEnvironment('uploads');
  const app = await buildApp();
  const createdContentIds: string[] = [];
  const createdFiles: string[] = [];

  try {
    console.log('--- 1. Upload a real PNG (admin CMS custom thumbnail) ---');
    const { body, boundary } = multipartBody('file', 'custom-cover.png', 'image/png', PNG_1PX);
    const uploadRes = await app.inject({
      method: 'POST',
      url: '/api/admin/uploads',
      payload: body,
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}`, 'x-admin-token': TOKEN },
    });
    check(uploadRes.statusCode === 201, `upload returns 201 (got ${uploadRes.statusCode})`);
    const upload = uploadRes.json().data as { url: string; filename: string; bytes: number; mime: string };
    check(upload.url?.startsWith('/uploads/'), `returned url is /uploads/… (${upload.url})`);
    check(upload.mime === 'image/png', `mime recorded (${upload.mime})`);
    check(upload.bytes === PNG_1PX.length, `bytes recorded (${upload.bytes})`);
    createdFiles.push(upload.filename);

    const onDisk = path.join(UPLOADS_DIR, upload.filename);
    check(fs.existsSync(onDisk), 'file written to server/uploads');
    check(fs.readFileSync(onDisk).equals(PNG_1PX), 'stored bytes match the uploaded image byte-for-byte');

    console.log('\n--- 2. Static serving of the uploaded file ---');
    const served = await app.inject({ method: 'GET', url: upload.url });
    check(served.statusCode === 200, `GET ${upload.url} → 200`);
    check(served.headers['content-type']?.toString().includes('image/png'), `content-type image/png`);
    check(served.rawPayload.equals(PNG_1PX), 'served image equals uploaded image');

    console.log('\n--- 3. Validation: non-image and oversized uploads are rejected ---');
    const bad = multipartBody('file', 'notes.txt', 'text/plain', Buffer.from('not an image'));
    const badRes = await app.inject({
      method: 'POST',
      url: '/api/admin/uploads',
      payload: bad.body,
      headers: { 'content-type': `multipart/form-data; boundary=${bad.boundary}`, 'x-admin-token': TOKEN },
    });
    check(badRes.statusCode === 415, `text/plain rejected with 415 (got ${badRes.statusCode})`);

    // Fase 5.3 — the declared Content-Type is a claim; the bytes decide.
    const lie = multipartBody('file', 'payload.png', 'image/png', HTML_BYTES);
    const lieRes = await app.inject({
      method: 'POST',
      url: '/api/admin/uploads',
      payload: lie.body,
      headers: { 'content-type': `multipart/form-data; boundary=${lie.boundary}`, 'x-admin-token': TOKEN },
    });
    const lieBody = lieRes.json() as any;
    check(
      lieRes.statusCode === 415 && lieBody?.error?.code === 'UNSUPPORTED_TYPE',
      `HTML bytes declared as image/png are rejected with 415 (got ${lieRes.statusCode})`,
    );
    check(
      fs.readdirSync(UPLOADS_DIR).filter((f) => f.includes('payload')).length === 0,
      'the rejected file is not written to the uploads directory',
    );

    const mislabelled = multipartBody('file', 'actually-a-photo.jpg', 'image/jpeg', PNG_1PX);
    const mislabelledRes = await app.inject({
      method: 'POST',
      url: '/api/admin/uploads',
      payload: mislabelled.body,
      headers: { 'content-type': `multipart/form-data; boundary=${mislabelled.boundary}`, 'x-admin-token': TOKEN },
    });
    const mislabelledJson = mislabelledRes.json() as any;
    check(
      mislabelledRes.statusCode === 201 && mislabelledJson?.data?.mime === 'image/png' && /\.png$/.test(mislabelledJson?.data?.filename ?? ''),
      `a PNG declared as JPEG is stored as PNG (${mislabelledJson?.data?.mime}, ${mislabelledJson?.data?.filename})`,
    );

    const jpeg = multipartBody('file', 'lecture-cover.jpg', 'image/jpeg', JPEG_1PX);
    const jpegRes = await app.inject({
      method: 'POST',
      url: '/api/admin/uploads',
      payload: jpeg.body,
      headers: { 'content-type': `multipart/form-data; boundary=${jpeg.boundary}`, 'x-admin-token': TOKEN },
    });
    const jpegJson = jpegRes.json() as any;
    check(
      jpegRes.statusCode === 201 && jpegJson?.data?.mime === 'image/jpeg',
      `a real JPEG is accepted and reported as image/jpeg (${jpegRes.statusCode} ${jpegJson?.data?.mime})`,
    );

    // The two extra uploads leave no trace: deleted through the API before the rest of the suite runs.
    for (const extra of [mislabelledJson?.data?.filename, jpegJson?.data?.filename].filter(Boolean)) {
      await app.inject({ method: 'DELETE', url: `/api/admin/uploads/${extra}`, headers: { 'x-admin-token': TOKEN } });
    }
    check(
      fs.readdirSync(UPLOADS_DIR).filter((f) => f.includes('mislabelled') || f.includes('actually-a-photo') || f.includes('lecture-cover')).length === 0,
      'the type-check uploads are cleaned up again',
    );

    const big = multipartBody('file', 'huge.png', 'image/png', BIG_BLOB);
    const bigRes = await app.inject({
      method: 'POST',
      url: '/api/admin/uploads',
      payload: big.body,
      headers: { 'content-type': `multipart/form-data; boundary=${big.boundary}`, 'x-admin-token': TOKEN },
    });
    check(bigRes.statusCode === 413, `>5MB rejected with 413 (got ${bigRes.statusCode})`);
    const leftover = fs.readdirSync(UPLOADS_DIR).filter((f) => f.includes('huge'));
    check(leftover.length === 0, 'partial file of the rejected oversized upload is cleaned up');

    console.log('\n--- 4. Persist custom thumbnail on real Content (API) ---');
    const scholar = await prisma.scholar.findFirst({ where: { status: 'published' } });
    const subject = await prisma.subject.findFirst({ where: { status: 'published' } });
    if (!scholar || !subject) throw new Error('seed data missing (scholar/subject)');

    const stamp = Date.now();
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/admin/contents',
      headers: { 'x-admin-token': TOKEN },
      payload: {
        type: 'audio',
        title: `Upload test audio ${stamp}`,
        provider: 'archive',
        sourceUrl: 'https://archive.org/details/RenewingOurIntentions',
        externalIdentifier: `upload-test-${stamp}`,
        status: 'published',
        thumbnailUrl: upload.url,
        scholarIds: [scholar.id],
        subjectIds: [subject.id],
      },
    });
    check(createRes.statusCode === 201, `content created with custom thumbnail (got ${createRes.statusCode})`);
    const created = createRes.json().data as any;
    createdContentIds.push(created.id);
    check(created.thumbnailUrl === upload.url, `thumbnailUrl persisted in DB as ${created.thumbnailUrl}`);

    const fromDb = await prisma.content.findUnique({ where: { id: created.id } });
    check(fromDb?.thumbnailUrl === upload.url, 're-read from database returns the custom upload path');

    console.log('\n--- 5. Public API exposes the custom thumbnail (priority over provider) ---');
    const publicRes = await app.inject({ method: 'GET', url: `/api/contents/${created.id}` });
    const pub = publicRes.json().data as any;
    check(publicRes.statusCode === 200, 'public detail endpoint returns 200');
    check(pub.thumbnailUrl === upload.url, 'public payload carries the custom thumbnail');

    console.log('\n--- 6. PATCH replaces and then clears the custom thumbnail ---');
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/admin/contents/${created.id}`,
      headers: { 'x-admin-token': TOKEN },
      payload: { thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' },
    });
    check(patchRes.json().data.thumbnailUrl === 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', 'PATCH switches back to a provider URL');

    const clearRes = await app.inject({
      method: 'PATCH',
      url: `/api/admin/contents/${created.id}`,
      headers: { 'x-admin-token': TOKEN },
      payload: { thumbnailUrl: '' },
    });
    check(clearRes.json().data.thumbnailUrl === null, 'PATCH with "" clears the thumbnail (falls back to provider/placeholder)');

    console.log('\n--- 7. Relative /uploads path passes validation, junk is rejected ---');
    const junkRes = await app.inject({
      method: 'PATCH',
      url: `/api/admin/contents/${created.id}`,
      headers: { 'x-admin-token': TOKEN },
      payload: { thumbnailUrl: 'javascript:alert(1)' },
    });
    check(junkRes.statusCode === 400, `non-media URL rejected with 400 (got ${junkRes.statusCode})`);

    const relRes = await app.inject({
      method: 'PATCH',
      url: `/api/admin/contents/${created.id}`,
      headers: { 'x-admin-token': TOKEN },
      payload: { thumbnailUrl: upload.url },
    });
    check(relRes.statusCode === 200 && relRes.json().data.thumbnailUrl === upload.url, 'relative /uploads path accepted again');

    console.log('\n--- 8. Listing + deleting uploads ---');
    const listRes = await app.inject({ method: 'GET', url: '/api/admin/uploads', headers: { 'x-admin-token': TOKEN } });
    const listing = listRes.json().data as any[];
    check(listing.some((f) => f.filename === upload.filename), 'uploaded file appears in the uploads listing');
    check(listing.every((f) => /\.(jpe?g|png|webp|gif|avif)$/i.test(f.filename)), 'listing only contains image files');

    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/admin/uploads/${upload.filename}`,
      headers: { 'x-admin-token': TOKEN },
    });
    check(delRes.statusCode === 200 && !fs.existsSync(onDisk), 'DELETE removes the file from disk');
    createdFiles.length = 0;
  } catch (e: any) {
    fail(`unexpected error: ${e?.stack ?? e?.message ?? e}`);
  } finally {
    for (const id of createdContentIds) {
      await prisma.content.delete({ where: { id } }).catch(() => {});
    }
    if (createdContentIds.length) ok('cleanup: test content removed from database');
    for (const f of createdFiles) {
      try {
        fs.unlinkSync(path.join(UPLOADS_DIR, f));
      } catch {}
    }
    await app.close();
    await prisma.$disconnect();
  }

  console.log(`\n${failed === 0 ? '✅ All upload/thumbnail tests passed' : `❌ ${failed} checks failed`} (${passed} passed, ${failed} failed)`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
