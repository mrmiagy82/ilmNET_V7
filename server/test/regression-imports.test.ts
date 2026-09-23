/**
 * Fase 3.7 regression — import the four real sources through the admin API, publish them,
 * and verify the library structure (series/collections, thumbnails, audio, downloads).
 *
 * Run with the backend up:   npx tsx test/regression-imports.test.ts
 * (writes real content to the configured database — intended for dev/staging)
 */
const API = process.env.API_URL || 'http://localhost:3001';
const TOKEN = process.env.ADMIN_TOKEN || 'ilmnet-admin-dev-2026';

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

async function api(path: string, method = 'GET', body?: any) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-admin-token': TOKEN },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json).slice(0, 200)}`);
  return json;
}

const SOURCES = {
  ytSingle: 'https://youtu.be/T-4XGWUV8hI?si=CYI_nUlBmI5qgASh',
  ytPlaylist: 'https://youtube.com/playlist?list=PLB1_h06YGESJOklRpiVLn6S4qsk4azOrZ&si=TdkXIoiORTzfsmoV',
  archiveBooks: 'https://archive.org/details/CollectionOfIslamicBooks/Atlas%20Of%20The%20Quran/',
  archiveAudio: 'https://archive.org/details/RenewingOurIntentions',
};

async function importSource(kind: 'youtube' | 'archive', url: string, limit: number, scholarIds: string[], subjectIds: string[]) {
  const preview = await api(`/api/admin/imports/${kind}/preview`, 'POST', { sourceUrl: url });
  const items = preview.items.slice(0, limit).map((it: any) => ({
    identifier: it.identifier,
    selected: true,
    contentType: it.kind === 'book' ? 'book' : it.kind === 'audio' ? 'audio' : it.kind === 'video' ? 'video' : undefined,
    scholarIds,
    subjectIds,
    language: it.language ?? 'English',
    status: 'published',
  }));
  const confirmed = await api(`/api/admin/imports/${kind}/confirm`, 'POST', { jobId: preview.jobId, items });
  return { preview, confirmed };
}

async function main() {
  console.log(`API: ${API}\n`);
  const scholars = (await api('/api/admin/scholars')).data;
  const subjects = (await api('/api/admin/subjects')).data;
  const scholarIds = [scholars[0].id];
  const subjectIds = [subjects[0].id];
  const created: string[] = [];

  // ── 1. YouTube single ──
  console.log('--- 1. YouTube single (real import) ---');
  const single = await importSource('youtube', SOURCES.ytSingle, 1, scholarIds, subjectIds);
  check(single.preview.totalItems === 1, `preview detects a single video (${single.preview.totalItems})`);
  check(single.confirmed.summary.created + single.confirmed.summary.duplicates === 1, `confirm created/duplicate (${JSON.stringify(single.confirmed.summary)})`);

  // ── 2. YouTube playlist → one series ──
  console.log('\n--- 2. YouTube playlist becomes one series ---');
  const playlist = await importSource('youtube', SOURCES.ytPlaylist, 7, scholarIds, subjectIds);
  check(playlist.preview.isCollection === true, 'playlist preview is flagged as a collection');
  check(playlist.preview.totalItems >= 5, `playlist has ${playlist.preview.totalItems} items`);
  const seriesId = playlist.preview.identifier;
  const seriesContents = (await api(`/api/admin/contents?limit=100&q=${encodeURIComponent(seriesId)}`)).data.filter(
    (c: any) => c.collectionIdentifier === seriesId,
  );
  check(seriesContents.length >= 5, `all playlist items share collectionIdentifier (${seriesContents.length} items)`);
  check(seriesContents.every((c: any) => c.collectionTitle === playlist.preview.title), `collectionTitle stored ("${playlist.preview.title}")`);
  const publishedSeries = seriesContents.filter((c: any) => c.status === 'published');
  check(publishedSeries.length >= 5, `${publishedSeries.length} playlist episodes published`);
  seriesContents.forEach((c: any) => created.push(c.id));
  const playlistThumb = publishedSeries.find((c: any) => c.thumbnailUrl?.includes('ytimg.com'));
  check(Boolean(playlistThumb), 'playlist episodes carry real YouTube thumbnails');

  // ── 3. Archive book collection ──
  console.log('\n--- 3. Archive books stay grouped as one collection ---');
  const books = await importSource('archive', SOURCES.archiveBooks, 8, scholarIds, subjectIds);
  check(books.preview.totalItems >= 8, `archive preview detects ${books.preview.totalItems} books`);
  const bookItems = (await api(`/api/admin/contents?limit=100&q=${encodeURIComponent(books.preview.identifier)}`)).data.filter(
    (c: any) => c.collectionIdentifier === books.preview.identifier,
  );
  check(bookItems.length >= 8, `${bookItems.length} books share collectionIdentifier ${books.preview.identifier}`);
  bookItems.forEach((c: any) => created.push(c.id));

  // ── 4. Archive audio collection ──
  console.log('\n--- 4. Archive audio: grouping, direct stream, download ---');
  const audio = await importSource('archive', SOURCES.archiveAudio, 3, scholarIds, subjectIds);
  check(audio.preview.totalItems >= 50, `archive audio preview detects ${audio.preview.totalItems} tracks`);
  const audioItems = (await api(`/api/admin/contents?limit=100&q=${encodeURIComponent(audio.preview.identifier)}`)).data.filter(
    (c: any) => c.collectionIdentifier === audio.preview.identifier,
  );
  check(audioItems.length >= 3, `${audioItems.length} audio tracks imported`);
  audioItems.forEach((c: any) => created.push(c.id));

  const firstAudio = audioItems.find((c: any) => c.status === 'published') ?? audioItems[0];
  check(Boolean(firstAudio?.externalIdentifier?.startsWith(`${audio.preview.identifier}--`)), `track identifier is file-level (${firstAudio?.externalIdentifier})`);
  const streamUrl = `https://archive.org/download/${audio.preview.identifier}/${String(firstAudio.externalIdentifier).split('--').slice(1).join('--')}.mp3`;
  const streamRes = await fetch(streamUrl, { method: 'HEAD', redirect: 'manual' });
  check([200, 302].includes(streamRes.status), `direct MP3 stream URL responds ${streamRes.status} (${streamUrl.slice(0, 90)}…)`);
  const downloadRes = await fetch(streamUrl, { method: 'GET', headers: { range: 'bytes=0-1023' } });
  check(downloadRes.status === 206 || downloadRes.status === 200, `download returns audio bytes (${downloadRes.status}, ${downloadRes.headers.get('content-type')})`);

  // ── 5. Public library health ──
  console.log('\n--- 5. Public library after the imports ---');
  const publicList = (await fetch(`${API}/api/contents?limit=100`).then((r) => r.json())).data;
  const byCollection = publicList.reduce((acc: Record<string, number>, c: any) => {
    if (c.collectionIdentifier) acc[c.collectionIdentifier] = (acc[c.collectionIdentifier] ?? 0) + 1;
    return acc;
  }, {});
  check((byCollection[seriesId] ?? 0) >= 5, `public library groups the playlist (${byCollection[seriesId]} episodes)`);
  check((byCollection[books.preview.identifier] ?? 0) >= 8, `public library groups the book collection (${byCollection[books.preview.identifier]} books)`);
  check((byCollection[audio.preview.identifier] ?? 0) >= 3, `public library groups the audio collection (${byCollection[audio.preview.identifier]} tracks)`);
  check(
    publicList.every((c: any) => c.status === 'published' || c.status === undefined),
    'public list only contains published records',
  );

  console.log(`\n${failed === 0 ? '✅ Import regression passed' : `❌ ${failed} checks failed`} (${passed} passed, ${failed} failed)`);
  console.log(`(imported/publish content stays in the database: ${created.length} records touched)`);
  process.exit(failed === 0 ? 0 : 1);
}

void main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
