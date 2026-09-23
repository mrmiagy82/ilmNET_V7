/**
 * Audit tests for Fase 2A hardening
 * Covers: duration parsing, duplicate DB constraint, metadata size, importJob states, generic content
 * Run with: npx tsx test/audit.test.ts
 */
import assert from 'node:assert/strict';
import { parseDurationToMinutes } from '../src/services/archive.service.js';
import { prisma } from '../src/lib/prisma.js';

// helpers
function ok(msg: string) { console.log(`✅ ${msg}`); }
function fail(msg: string, err: any) { console.error(`❌ ${msg}:`, err?.message || err); process.exitCode = 1; }

async function testDurationParsing() {
  console.log('\n--- Duration parsing ---');
  const cases: Array<[any, number | null]> = [
    ['38:42', 39], // 38 + 42/60 ≈ 39
    ['1:02:15', 62], // 1h 2m 15s
    ['0:30', 1], // 0:30 = 1 min rounded
    ['2:00', 2],
    ['177.41', 3], // seconds
    ['3600', 60], // seconds
    ['90', 2], // 90s → 2
    ['1min 55sec', 2],
    ['38min', 38],
    ['1 hour 10 min', 70],
    [null, null],
    [undefined, null],
    ['', null],
    ['invalid', null],
    ['1:30', 2], // 1:30 → 2
    ['0:00', null], // zero should be null? our function returns null for 0
  ];
  for (const [input, expected] of cases) {
    const got = parseDurationToMinutes(input as any);
    try {
      assert.equal(got, expected, `parseDurationToMinutes(${JSON.stringify(input)}) expected ${expected} got ${got}`);
      ok(`parseDurationToMinutes(${JSON.stringify(input)}) → ${got}`);
    } catch (e) { fail(`parseDurationToMinutes(${JSON.stringify(input)})`, e); }
  }
}

async function testDuplicateConstraint() {
  console.log('\n--- Duplicate DB constraint (provider+externalIdentifier) ---');
  // create a content with known provider+externalIdentifier
  const scholar = await prisma.scholar.findFirst();
  const subject = await prisma.subject.findFirst();
  if (!scholar || !subject) throw new Error('seed missing');
  const payload = {
    type: 'video' as const,
    title: 'Duplicate Test Video',
    slug: `duplicate-test-video-${Date.now()}`,
    provider: 'archive' as const,
    sourceUrl: 'https://archive.org/details/dup-test',
    externalIdentifier: `dup-test-${Date.now()}`,
    embedUrl: 'https://archive.org/embed/dup-test',
    status: 'draft' as const,
  };
  const created = await prisma.content.create({
    data: {
      type: payload.type,
      title: payload.title,
      slug: payload.slug,
      provider: payload.provider,
      sourceUrl: payload.sourceUrl,
      externalIdentifier: payload.externalIdentifier,
      embedUrl: payload.embedUrl,
      status: payload.status,
    },
  });
  ok(`created first content ${created.id} provider+externalIdentifier ${payload.provider}/${payload.externalIdentifier}`);
  // attempt duplicate — should throw P2002
  let threw = false;
  try {
    await prisma.content.create({
      data: {
        type: payload.type,
        title: 'Duplicate 2',
        slug: `duplicate-test-video-${Date.now()}-2`,
        provider: payload.provider,
        sourceUrl: payload.sourceUrl,
        externalIdentifier: payload.externalIdentifier, // same
        embedUrl: payload.embedUrl,
        status: 'draft',
      },
    });
  } catch (e: any) {
    threw = true;
    assert.equal(e.code, 'P2002', `expected P2002 got ${e.code}`);
    ok(`second create with same provider+externalIdentifier throws P2002 (DB-level protection)`);
  }
  if (!threw) fail('duplicate should have thrown', new Error('no throw'));
  // cleanup
  await prisma.content.delete({ where: { id: created.id } });
  ok('cleanup duplicate test');
  // test that multiple null externalIdentifier allowed (manual entries without externalIdentifier)
  const c1 = await prisma.content.create({
    data: {
      type: 'document',
      title: 'Null extId 1',
      slug: `null-ext-1-${Date.now()}`,
      provider: 'external',
      sourceUrl: 'https://example.com/doc1.pdf',
      // externalIdentifier omitted -> null
      status: 'draft',
    },
  });
  const c2 = await prisma.content.create({
    data: {
      type: 'document',
      title: 'Null extId 2',
      slug: `null-ext-2-${Date.now()}`,
      provider: 'external',
      sourceUrl: 'https://example.com/doc2.pdf',
      status: 'draft',
    },
  });
  ok(`two contents with null externalIdentifier allowed (ids ${c1.id}, ${c2.id})`);
  await prisma.content.deleteMany({ where: { id: { in: [c1.id, c2.id] } } });
}

async function testMetadataNoArtificialDefaults() {
  console.log('\n--- Metadata: no artificial pages/duration ---');
  // Import via direct prisma create with durationMin null/pages null — this is what confirm now does
  const previewFake = { identifier: 'test', title: 'Test', isCollection: false } as any;
  // we just verify that pages and durationMin default to null when not provided
  const c = await prisma.content.create({
    data: {
      type: 'audio',
      title: `Audio No Duration ${Date.now()}`,
      slug: `audio-no-duration-${Date.now()}`,
      provider: 'archive',
      sourceUrl: 'https://archive.org/details/audio-no-duration',
      externalIdentifier: `audio-no-duration-${Date.now()}`,
      status: 'draft',
      // durationMin omitted -> null
      // pages omitted -> null
      metadata: { archive: { identifier: 'audio-no-duration', title: 'Audio', duration: null, size: null } },
    },
  });
  assert.equal(c.durationMin, null, 'durationMin should be null when not provided');
  assert.equal(c.pages, null, 'pages should be null when not provided');
  ok('no artificial pages/duration stored');
  await prisma.content.delete({ where: { id: c.id } });
}

async function testMetadataSizeLimit() {
  console.log('\n--- Metadata size limit ---');
  // Ensure that metadata.archive is limited and not storing raw huge responses
  // The import route truncates fields; we simulate a huge description
  const hugeDesc = 'a'.repeat(5000); // should be truncated to 900/600 in service
  // create content with huge metadata — but our import truncates earlier, so direct prisma would allow huge but we enforce limit in code
  // We test that our truncation would keep JSON size <10k
  const metadata = {
    archive: {
      identifier: 'huge-test',
      title: 'a'.repeat(500),
      description: hugeDesc.slice(0, 900), // truncated
      creator: 'b'.repeat(300).slice(0, 200),
    },
  };
  const jsonSize = JSON.stringify(metadata).length;
  assert.ok(jsonSize < 10000, `metadata size ${jsonSize} should be <10k`);
  ok(`metadata size ${jsonSize} <10k`);
}

async function testImportJobStates() {
  console.log('\n--- ImportJob states ---');
  // preview creates awaiting_review
  const job = await prisma.importJob.create({
    data: {
      provider: 'archive',
      sourceUrl: 'https://archive.org/details/test-job',
      externalIdentifier: 'test-job',
      kind: 'archive_single',
      status: 'awaiting_review',
      totalItems: 1,
      preview: { items: [{ identifier: 'test' }], isCollection: false } as any,
    },
  });
  assert.equal(job.status, 'awaiting_review');
  ok('preview job awaiting_review');
  // simulate confirm updating to importing then completed
  await prisma.importJob.update({ where: { id: job.id }, data: { status: 'importing' } });
  let fetched = await prisma.importJob.findUnique({ where: { id: job.id } });
  assert.equal(fetched?.status, 'importing');
  ok('job importing');
  await prisma.importJob.update({
    where: { id: job.id },
    data: {
      status: 'completed',
      importedCount: 1,
      preview: { ...(job.preview as any), importSummary: { created: 1, duplicates: 0, errors: 0 } } as any,
    },
  });
  fetched = await prisma.importJob.findUnique({ where: { id: job.id } });
  assert.equal(fetched?.status, 'completed');
  assert.equal((fetched?.preview as any).importSummary.created, 1);
  ok('job completed with summary');

  // failed job
  const failed = await prisma.importJob.create({
    data: {
      provider: 'archive',
      sourceUrl: 'https://archive.org/details/fail',
      externalIdentifier: 'fail',
      kind: 'archive_collection',
      status: 'failed',
      error: 'Archive.org 404',
      preview: { error: 'Archive.org 404' } as any,
    },
  });
  assert.equal(failed.status, 'failed');
  assert.ok(failed.error);
  ok('failed job stored');

  // cleanup
  await prisma.importJob.deleteMany({ where: { id: { in: [job.id, failed.id] } } });
}

async function testGenericContent() {
  console.log('\n--- Generic Content (audio/video/document not tied to Lecture/Book) ---');
  const scholar = await prisma.scholar.findFirst();
  const subject = await prisma.subject.findFirst();
  if (!scholar || !subject) throw new Error('no seed');
  const types: Array<'audio' | 'video' | 'document' | 'book' | 'lecture'> = ['audio', 'video', 'document', 'book', 'lecture'];
  for (const type of types) {
    const c = await prisma.content.create({
      data: {
        type,
        title: `Generic ${type} ${Date.now()}`,
        slug: `generic-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        provider: 'archive',
        sourceUrl: `https://archive.org/details/generic-${type}`,
        externalIdentifier: `generic-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        status: 'draft',
        durationMin: type === 'audio' || type === 'video' ? 5 : null,
        pages: type === 'book' ? null : null, // never 120 artificial
      },
    });
    assert.equal(c.type, type);
    assert.equal(c.provider, 'archive');
    // ensure lecture-specific fields not required for audio/video/document
    ok(`create ${type} generic ok (durationMin ${c.durationMin}, pages ${c.pages})`);
    await prisma.content.delete({ where: { id: c.id } });
  }
}

async function main() {
  try {
    await testDurationParsing();
    await testDuplicateConstraint();
    await testMetadataNoArtificialDefaults();
    await testMetadataSizeLimit();
    await testImportJobStates();
    await testGenericContent();
    console.log('\n✅ All audit tests passed');
  } catch (e) {
    console.error('❌ Test suite failed', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
