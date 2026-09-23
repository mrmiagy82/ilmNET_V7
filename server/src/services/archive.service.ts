/**
 * Archive.org provider service — pure provider logic, no generic Content CRUD.
 * Used by import routes for preview & confirm.
 */

const ARCHIVE_ORIGIN = 'https://archive.org';
const FETCH_TIMEOUT_MS = 7000;
const MAX_ITEMS = 100;
const CONCURRENCY = 5;

// ── helpers: fetch with timeout ──
async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'ilmNet/1.0 (archive-preview; +https://ilmnet.example)' },
    });
    if (!res.ok) throw new Error(`Archive.org ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// ── identifier parsing ──
export function parseArchiveIdentifier(sourceUrl: string): string | null {
  try {
    const u = new URL(sourceUrl.trim());
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    const isArchiveHost = host === 'archive.org' || host.endsWith('.archive.org');
    // search URLs: try to extract collection:(identifier) from query
    const q = u.searchParams.get('query') || u.searchParams.get('q') || '';
    if (q) {
      const m = q.match(/collection\s*:\s*\(?\s*["']?([a-zA-Z0-9_\-\.]+)["']?\s*\)?/i);
      if (m && m[1]) return m[1];
      // also catch q=collection:identifier without parens
      const m2 = q.match(/collection[:\s]+([a-zA-Z0-9_\-\.]+)/i);
      if (m2 && m2[1]) return m2[1];
    }
    // path based
    if (isArchiveHost || sourceUrl.includes('archive.org')) {
      const parts = u.pathname.split('/').filter(Boolean);
      // /details/<id> , /embed/<id> , /search, /services/…
      const idxDetails = parts.indexOf('details');
      if (idxDetails !== -1 && parts[idxDetails + 1]) return parts[idxDetails + 1].split('?')[0].split('#')[0];
      if (parts[0] === 'embed' && parts[1]) return parts[1].split('?')[0];
      // fallback: /download/<id>/… not used but handle
      if (parts[0] === 'download' && parts[1]) return parts[1];
      // search page without query but path contains collection?
      // legacy: /details/<collection>/… sometimes
      if (parts.length === 1 && parts[0] !== 'search' && parts[0] !== 'search.php' && parts[0] !== 'services') {
        return parts[0];
      }
    }
    // fallback regex anywhere in url
    const m = sourceUrl.match(/archive\.org\/details\/([a-zA-Z0-9_\-\.]+)/i);
    if (m) return m[1];
    const m2 = sourceUrl.match(/archive\.org\/embed\/([a-zA-Z0-9_\-\.]+)/i);
    if (m2) return m2[1];
    return null;
  } catch {
    return null;
  }
}

export function isArchiveUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return host === 'archive.org' || host.endsWith('.archive.org');
  } catch {
    return false;
  }
}

export function archiveItemLink(identifier: string): string {
  return `${ARCHIVE_ORIGIN}/details/${identifier}`;
}
export function archiveEmbedLink(identifier: string): string {
  return `${ARCHIVE_ORIGIN}/embed/${identifier}`;
}
export function archiveThumbLink(identifier: string): string {
  return `${ARCHIVE_ORIGIN}/services/img/${identifier}`;
}

// ── language normalization ──
const LANG_MAP: Record<string, string> = {
  eng: 'English',
  en: 'English',
  ara: 'Arabic',
  ar: 'Arabic',
  urd: 'Urdu',
  ur: 'Urdu',
  fra: 'French',
  fre: 'French',
  fr: 'French',
  deu: 'German',
  ger: 'German',
  spa: 'Spanish',
  tur: 'Turkish',
  fas: 'Persian',
  per: 'Persian',
};

function normalizeLanguage(raw: any): string | undefined {
  if (!raw) return undefined;
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (!first) return undefined;
  const s = String(first).trim();
  const low = s.toLowerCase();
  if (LANG_MAP[low]) return LANG_MAP[low];
  // already English etc
  if (['english', 'arabic', 'urdu', 'french', 'german', 'spanish'].includes(low)) {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
  // language may be like "English" already
  return s;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeDescription(raw: any): string | undefined {
  if (!raw) return undefined;
  const str = Array.isArray(raw) ? raw[0] : raw;
  if (!str) return undefined;
  const cleaned = stripHtml(String(str));
  return cleaned.slice(0, 900);
}

function toYear(dateRaw: any, yearRaw: any): number | undefined {
  if (yearRaw) {
    const y = parseInt(String(yearRaw), 10);
    if (!isNaN(y) && y > 1000 && y < 2100) return y;
  }
  if (dateRaw) {
    const first = Array.isArray(dateRaw) ? dateRaw[0] : dateRaw;
    if (first) {
      const m = String(first).match(/(19|20)\d{2}/);
      if (m) return parseInt(m[0], 10);
    }
  }
  return undefined;
}

// ── duration parsing — correct for “38:42”, “1:02:15”, seconds, “1min 55sec” ──
export function parseDurationToMinutes(raw: string | number | undefined | null): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // pure seconds numeric like “177.41” or “3600” or number 177.41
  // Detect if string is plain number (seconds) — e.g. "177.41" or "90" without colons or “min”/“sec”
  if (!s.includes(':') && !/min|sec|hour|hr/i.test(s)) {
    const num = Number(s.replace(',', '.'));
    if (!isNaN(num) && isFinite(num) && num > 0) {
      // heuristic: if > 3600 likely milliseconds? but assume seconds if >0 and fits plausible range
      // Archive files[].length sometimes is “38:42” already handled above; plain numbers are seconds.
      // We consider values 1…36000 as seconds (up to 10h). Convert to minutes.
      // Use rounding to nearest minute, minimum 1.
      const mins = Math.round(num / 60);
      return mins > 0 ? mins : 1;
    }
  }

  // “1min 55sec” / “1m 55s” / “38min” etc
  const minMatch = s.match(/(\d+(?:\.\d+)?)\s*min/i);
  const secMatch = s.match(/(\d+(?:\.\d+)?)\s*sec/i);
  const hourMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:hour|hr|h)\b/i);
  if (minMatch || secMatch || hourMatch) {
    let totalMinutes = 0;
    if (hourMatch) totalMinutes += parseFloat(hourMatch[1]!) * 60;
    if (minMatch) totalMinutes += parseFloat(minMatch[1]!);
    if (secMatch) totalMinutes += parseFloat(secMatch[1]!) / 60;
    // handle “1:55” inside same string already handled, but if both, prefer explicit
    if (totalMinutes > 0) return Math.max(1, Math.round(totalMinutes));
  }

  // “HH:MM:SS” or “MM:SS” or “M:SS” — colon separated
  if (s.includes(':')) {
    // Remove any non-digit/colon prefix (e.g. “Duration: 1:02:15”)
    const colonPart = s.match(/(\d+:\d+(?::\d+)?(?:\.\d+)?)/);
    const candidate = colonPart ? colonPart[1]! : s;
    const parts = candidate.split(':').map((p) => p.trim());
    // handle H:MM:SS
    if (parts.length === 3) {
      const h = parseFloat(parts[0]!) || 0;
      const m = parseFloat(parts[1]!) || 0;
      const sec = parseFloat(parts[2]!) || 0;
      const totalMin = h * 60 + m + sec / 60;
      return totalMin > 0 ? Math.max(1, Math.round(totalMin)) : null;
    }
    if (parts.length === 2) {
      const m = parseFloat(parts[0]!) || 0;
      const sec = parseFloat(parts[1]!) || 0;
      const totalMin = m + sec / 60;
      return totalMin > 0 ? Math.max(1, Math.round(totalMin)) : null;
    }
    // single part with colon? already handled.
  }

  // fallback: try parse as int minutes directly (e.g. “30” but we intentionally do NOT fallback to 30)
  const asInt = parseInt(s, 10);
  if (!isNaN(asInt) && String(asInt) === s.trim() && asInt > 0 && asInt < 600) {
    return asInt;
  }

  return null;
}

// ── mediatype inference ──
export type ArchiveItemKind = 'audio' | 'video' | 'book' | 'document' | 'collection' | 'unknown';

function inferKind(mediatype: string | undefined, formats: string[]): ArchiveItemKind {
  const mt = (mediatype || '').toLowerCase();
  const joined = formats.join(' ').toLowerCase();
  if (mt === 'collection') return 'collection';
  if (mt === 'audio' || mt === 'etree') return 'audio';
  if (mt === 'movies') return 'video';
  if (mt === 'texts') {
    // texts with video formats? unlikely
    if (joined.includes('mpeg4') || joined.includes('h.264') || joined.includes('ogg video')) return 'video';
    if (joined.includes('mp3') || joined.includes('flac') || joined.includes('ogg') && !joined.includes('video')) return 'audio';
    return 'book';
  }
  // fallback via formats
  if (joined.includes('mp3') || joined.includes('flac') || joined.includes('shorten') || joined.includes('ogg') && !joined.includes('video')) {
    if (joined.includes('h.264') || joined.includes('mpeg4') || joined.includes('mp4') && joined.includes('video')) return 'video';
    return 'audio';
  }
  if (joined.includes('h.264') || joined.includes('mpeg4') || joined.includes('mp4') || joined.includes('ogg video') || joined.includes('matroska')) return 'video';
  if (joined.includes('pdf') || joined.includes('djvu') || joined.includes('epub') || joined.includes('text')) return joined.includes('pdf') || joined.includes('djvu') ? 'book' : 'document';
  return 'unknown';
}

const EXCLUDE_FORMATS = new Set([
  'item tile',
  'thumbnail',
  'metadata',
  'archive bittorrent',
  'jpeg thumb',
  'jpeg from video',
  'animated gif',
  'collection header',
  'single page processed jp2 zip',
  'processed jp2 zip',
  '600 dpi',
  'abbyy gz',
  'abbyy gult',
  'chocr.html.gz',
  'hocr_searchtext.txt.gz',
  'djvu.png',
  'epub',
]);

function collectMediaTypes(files: any[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of files) {
    const fmt: string = f.format || '';
    if (!fmt) continue;
    const low = fmt.toLowerCase();
    // exclude obvious non-content
    if (EXCLUDE_FORMATS.has(low)) continue;
    if (low.includes('thumb') && !low.includes('mp4') && !low.includes('mpeg')) continue;
    if (low === 'text' && files.some((x) => (x.format || '').toLowerCase() === 'pdf')) {
      // keep Text only if no PDF, else skip duplicate
      // but keep for now
    }
    if (low === 'abbyy gz' || low.includes('hocr')) continue;
    if (low.includes('torrent')) continue;
    if (low.includes('spectrogram')) continue;
    if (low.includes('waveform')) continue;
    if (low === 'm3u' || low === 'columbia') continue;
    const norm = fmt.trim();
    if (!seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  // if empty, fallback to mediatype-driven
  return out;
}

// ── normalize single metadata to ArchiveDetectedItem shape (matching frontend's data.ts) ──
export interface ArchiveDetectedItem {
  identifier: string;
  archiveUrl: string;
  embedUrl: string;
  title: string;
  kind: ArchiveItemKind;
  mediaTypes: string[];
  mediatype?: string;
  thumbnail?: string;
  creator?: string;
  date?: string;
  year?: number;
  language?: string;
  description?: string;
  collection?: string;
  subjectHint?: string;
  duration?: string;
  size?: string;
  publisher?: string;
}

export function normalizeSingle(metadataRes: any): ArchiveDetectedItem {
  const meta = metadataRes.metadata || {};
  const files: any[] = metadataRes.files || [];
  const id: string = meta.identifier || metadataRes.item_id || 'unknown';
  const titleRaw = meta.title;
  const title = Array.isArray(titleRaw) ? titleRaw[0] : titleRaw || id.replace(/[-_]/g, ' ');
  const mediatype: string | undefined = Array.isArray(meta.mediatype) ? meta.mediatype[0] : meta.mediatype;
  const mediaTypes = collectMediaTypes(files);
  const kind = inferKind(mediatype, mediaTypes.length ? mediaTypes : [mediatype || 'unknown']);

  const creatorRaw = meta.creator;
  const creator = creatorRaw ? (Array.isArray(creatorRaw) ? creatorRaw[0] : creatorRaw) : undefined;
  const dateRaw = meta.date;
  const date = dateRaw ? (Array.isArray(dateRaw) ? dateRaw[0] : String(dateRaw)) : undefined;
  const year = toYear(dateRaw, meta.year);
  const language = normalizeLanguage(meta.language);
  const description = normalizeDescription(meta.description);
  const subjectRaw = meta.subject;
  const subjectHint = subjectRaw ? (Array.isArray(subjectRaw) ? String(subjectRaw[0]).split(';')[0].trim() : String(subjectRaw).split(';')[0].trim()) : undefined;
  const publisherRaw = meta.publisher;
  const publisher = publisherRaw ? (Array.isArray(publisherRaw) ? publisherRaw[0] : String(publisherRaw)) : undefined;
  // duration from files or metadata runtime
  let duration: string | undefined;
  const runtimeRaw = meta.runtime;
  if (runtimeRaw) {
    duration = Array.isArray(runtimeRaw) ? String(runtimeRaw[0]) : String(runtimeRaw);
  } else {
    const withLen = files.find((f) => f.length);
    if (withLen) duration = String(withLen.length);
  }
  let size: string | undefined;
  if (metadataRes.item_size) {
    const bytes = Number(metadataRes.item_size);
    if (!isNaN(bytes)) {
      if (bytes < 1024 * 1024) size = `${(bytes / 1024).toFixed(1)} KB`;
      else size = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  }

  const collectionRaw = meta.collection;
  const collection = collectionRaw ? (Array.isArray(collectionRaw) ? collectionRaw[0] : String(collectionRaw)) : undefined;

  return {
    identifier: String(id),
    archiveUrl: archiveItemLink(String(id)),
    embedUrl: archiveEmbedLink(String(id)),
    title: String(title).slice(0, 300),
    kind,
    mediaTypes: mediaTypes.length ? mediaTypes : (mediatype ? [mediatype] : ['unknown']),
    mediatype,
    thumbnail: archiveThumbLink(String(id)),
    creator: creator ? String(creator).slice(0, 200) : undefined,
    date: date ? String(date).slice(0, 100) : undefined,
    year,
    language,
    description,
    collection,
    subjectHint: subjectHint?.slice(0, 100),
    duration,
    size,
    publisher: publisher?.slice(0, 200),
  };
}

// ── file-level detection for single items with many files (bulk via files) ──
function sanitizeBase(name: string): string {
  // strip extension and common derivative suffixes
  let s = name.trim();
  // remove extension
  s = s.replace(/\.(pdf|epub|mp3|ogg|m4a|mp4|mpeg4|flac|djvu|zip|gz|xml|txt|png|gif|jpg|jpeg)$/i, '');
  // remove derivative suffixes like _jp2, _abbyy, _djvu, _scandata, _spectrum, _thumb, etc
  s = s.replace(/(_jp2|_abbyy|_djvu|_scandata|_thumb|_small|_large|_hocr|_chocr|_spectrogram|_waveform|_columb|_m3u|_meta)$/i, '');
  // remove trailing _\d+
  s = s.replace(/_\d+$/, '');
  return s.trim();
}

function generateFileLevelItems(metaRes: any, parentId: string): ArchiveDetectedItem[] | null {
  const meta = metaRes.metadata || {};
  const files: any[] = metaRes.files || [];
  if (!files.length) return null;
  // Group by sanitized base name, only consider files that are likely content (pdf, mp3, etc)
  const groups: Record<string, any[]> = {};
  for (const f of files) {
    // Only consider original content files for bulk grouping (avoids counting derivatives like Additional Text PDF, Ogg Vorbis, etc twice)
    if (f.source !== 'original') continue;
    const name: string = f.name || '';
    const fmt: string = (f.format || '').toLowerCase();
    const isRelevant = 
      fmt.includes('pdf') || fmt.includes('epub') || fmt.includes('djvu') || 
      fmt.includes('mp3') || fmt.includes('ogg') || fmt.includes('flac') || fmt.includes('m4a') ||
      name.toLowerCase().endsWith('.pdf') || name.toLowerCase().endsWith('.mp3') || name.toLowerCase().endsWith('.ogg');
    if (!isRelevant) continue;
    if (fmt.includes('thumb') || fmt.includes('spectrogram') || fmt.includes('columbia')) continue;
    const base = sanitizeBase(name);
    if (!base || base.length < 2) continue;
    if (!groups[base]) groups[base] = [];
    groups[base].push(f);
  }
  const bases = Object.keys(groups);
  // Need at least 2 distinct bases to be bulk; if >100 cap to 100 instead of null
  if (bases.length < 2) return null;
  const cappedBases = bases.length > MAX_ITEMS ? bases.slice(0, MAX_ITEMS) : bases;
  // Check if bases are just variations of same book with different extensions? For a single book like Atlas, there is only 1 base, so not bulk.
  // For CollectionOfIslamicBooks, we have 8 bases, so bulk.
  // For RenewingOurIntentions, we have many distinct mp3 bases, so bulk.
  // Generate one item per base
  const items: ArchiveDetectedItem[] = [];
  const parentTitle: string = Array.isArray(meta.title) ? meta.title[0] : (meta.title || parentId);
  const parentCreator = Array.isArray(meta.creator) ? meta.creator[0] : meta.creator;
  const parentDate = Array.isArray(meta.date) ? meta.date[0] : meta.date;
  const parentLang = normalizeLanguage(meta.language);
  const parentYear = toYear(meta.date, meta.year);
  for (const base of cappedBases) {
    const groupFiles = groups[base]!;
    // Determine kind from group files' formats
    const mediaTypes = collectMediaTypes(groupFiles);
    const mediatypeForKind = mediaTypes[0] || 'unknown';
    const kind = inferKind(undefined, mediaTypes);
    // Find a representative file for thumbnail/duration
    const rep = groupFiles.find(f => f.format?.toLowerCase().includes('pdf') || f.format?.toLowerCase().includes('mp3')) || groupFiles[0];
    const duration = rep.length || groupFiles.find(f=>f.length)?.length;
    const size = rep.size ? `${(Number(rep.size)/(1024*1024)).toFixed(1)} MB` : undefined;
    // Use parentId + base as identifier (sanitized)
    const sanitized = base.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g,'_').slice(0,60);
    const identifier = `${parentId}--${sanitized}`;
    const title = base.replace(/[-_]/g, ' ').slice(0,300);
    items.push({
      identifier,
      archiveUrl: `https://archive.org/details/${parentId}/${encodeURIComponent(base)}`,
      embedUrl: `https://archive.org/embed/${parentId}?subPrefix=${encodeURIComponent(base)}`,
      title,
      kind,
      mediaTypes: mediaTypes.length ? mediaTypes : ['unknown'],
      mediatype: mediatypeForKind,
      thumbnail: archiveThumbLink(parentId),
      creator: parentCreator ? String(parentCreator).slice(0,200) : undefined,
      date: parentDate ? String(parentDate).slice(0,100) : undefined,
      year: parentYear,
      language: parentLang,
      description: `Part of ${parentTitle} — ${base}`,
      collection: parentId,
      subjectHint: undefined,
      duration: duration ? String(duration) : undefined,
      size,
      publisher: undefined,
    });
  }
  // Sort by base name for stable order
  items.sort((a,b)=> a.title.localeCompare(b.title));
  return items;
}

// ── fetch single metadata ──
export async function fetchMetadata(identifier: string): Promise<any | null> {
  try {
    const data = await fetchJson(`${ARCHIVE_ORIGIN}/metadata/${encodeURIComponent(identifier)}`);
    if (!data || data.error) return null;
    // Archive returns { metadata: {...}, files: [...] } even for not found? Check is_dark
    if (!data.metadata || !data.metadata.identifier) return null;
    return data;
  } catch (e: any) {
    return null;
  }
}

// ── fetch collection members via advanced search ──
export async function fetchCollectionMembers(
  collectionId: string,
  limit = MAX_ITEMS
): Promise<{ numFound: number; docs: any[] }> {
  const rows = Math.min(limit, MAX_ITEMS);
  const q = `collection:(${collectionId})`;
  const fl = ['identifier', 'title', 'mediatype', 'creator', 'date', 'description', 'language', 'subject'].join(',');
  const url = `${ARCHIVE_ORIGIN}/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=${encodeURIComponent('identifier')}&fl[]=${encodeURIComponent('title')}&fl[]=${encodeURIComponent('mediatype')}&fl[]=${encodeURIComponent('creator')}&fl[]=${encodeURIComponent('date')}&fl[]=${encodeURIComponent('description')}&fl[]=${encodeURIComponent('language')}&fl[]=${encodeURIComponent('subject')}&rows=${rows}&page=1&output=json&save=yes`;
  // Archive advancedsearch expects repeated fl[] params; constructing manually:
  const directUrl = `${ARCHIVE_ORIGIN}/advancedsearch.php?q=${encodeURIComponent(q)}&fl[]=identifier&fl[]=title&fl[]=mediatype&fl[]=creator&fl[]=date&fl[]=description&fl[]=language&fl[]=subject&rows=${rows}&page=1&output=json`;
  try {
    const data = await fetchJson(directUrl);
    const docs = data?.response?.docs || [];
    const numFound = data?.response?.numFound ?? docs.length;
    return { numFound, docs };
  } catch {
    // fallback: try scrape API
    try {
      const scrapeUrl = `${ARCHIVE_ORIGIN}/services/search/v1/scrape?fields=identifier,title,mediatype,creator,date,language&q=${encodeURIComponent(q)}&count=${rows}&scope=derived`;
      const data = await fetchJson(scrapeUrl);
      const items = data?.items || data?.response?.docs || [];
      return { numFound: items.length, docs: items.map((x: any) => ({ identifier: x.identifier, title: x.title, mediatype: x.mediatype, creator: x.creator, date: x.date, language: x.language, subject: x.subject })) };
    } catch {
      return { numFound: 0, docs: [] };
    }
  }
}

// ── preview orchestration ──
export interface ArchivePreview {
  sourceUrl: string;
  identifier: string;
  title: string;
  description?: string;
  totalItems: number;
  items: ArchiveDetectedItem[];
  fetchedAt: string;
  isCollection: boolean;
  isSingleItem: boolean;
  provider: 'archive';
  kindsSummary: Record<string, number>;
  collectionTitle?: string;
}

export async function previewArchive(sourceUrl: string): Promise<ArchivePreview> {
  const identifier = parseArchiveIdentifier(sourceUrl);
  if (!identifier) throw new Error(`Cannot parse Archive.org identifier from URL: ${sourceUrl}`);
  const metaRes = await fetchMetadata(identifier);
  if (!metaRes) throw new Error(`Archive.org item not found: ${identifier} (from ${sourceUrl})`);
  const meta = metaRes.metadata || {};
  const mediatype: string | undefined = Array.isArray(meta.mediatype) ? meta.mediatype[0] : meta.mediatype;
  const isCollectionType = mediatype === 'collection';

  // Check if it's a collection: mediatype collection OR has many members via search
  let isCollection = isCollectionType;
  let docs: any[] | null = null;
  let numFound = 0;

  if (isCollection) {
    const res = await fetchCollectionMembers(identifier, MAX_ITEMS);
    docs = res.docs;
    numFound = res.numFound;
    // If collection empty but mediatype collection, still treat as collection with 0 items? We'll still try.
    // If docs empty, we fallback to single (maybe collection with no derived search index yet)
    if (docs.length === 0) {
      // Still return single collection item itself? Better to return single
      // But spec expects collection -> items, so return single fallback
      const single = normalizeSingle(metaRes);
      return {
        sourceUrl: sourceUrl.trim(),
        identifier,
        title: single.title,
        description: single.description,
        totalItems: 1,
        items: [single],
        fetchedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        isCollection: false,
        isSingleItem: true,
        provider: 'archive',
        kindsSummary: { [single.kind]: 1 },
      };
    }
    // else is collection
  } else {
    // For non-collection, double-check if this identifier actually contains many items via search (some collections not marked as mediatype collection but still act as collections)
    // Only treat as collection if search finds >1 items and mediatype not strongly single
    // We will peek at search count; if >5 items, treat as collection to be helpful
    try {
      const res = await fetchCollectionMembers(identifier, 5);
      if (res.numFound > 5 && res.docs.length > 3) {
        // Likely a collection that is not typed as collection (e.g., curated set)
        isCollection = true;
        docs = res.docs.slice(0, MAX_ITEMS);
        numFound = res.numFound;
      }
    } catch {}
  }

  if (isCollection && docs) {
    // Fast path: map search docs directly without per-item metadata fetch (avoids 100× network).
    // This keeps preview snappy for 100-item collections (prelinger/etree) and is still accurate.
    // MediaTypes are synthesized from mediatype; detailed file formats would require per-item fetch.
    const limitedDocs = docs.slice(0, MAX_ITEMS);

    function synthMediaTypes(mediatype?: string): string[] {
      if (!mediatype) return ['unknown'];
      const low = mediatype.toLowerCase();
      if (low === 'etree' || low === 'audio') return ['MP3', 'Ogg Vorbis'];
      if (low === 'movies') return ['MPEG4', 'h.264'];
      if (low === 'texts') return ['PDF', 'Text'];
      if (low === 'collection') return ['collection'];
      return [mediatype];
    }

    const results: ArchiveDetectedItem[] = limitedDocs.map((doc: any) => {
      const id = String(doc.identifier);
      const mediatype: string | undefined = Array.isArray(doc.mediatype) ? doc.mediatype[0] : doc.mediatype;
      const titleRaw: string | undefined = Array.isArray(doc.title) ? doc.title[0] : doc.title;
      const creatorRaw = doc.creator;
      const creator = creatorRaw ? (Array.isArray(creatorRaw) ? creatorRaw[0] : String(creatorRaw)) : undefined;
      const dateRaw = doc.date;
      const date = dateRaw ? (Array.isArray(dateRaw) ? String(dateRaw[0]) : String(dateRaw)) : undefined;
      const descRaw = doc.description;
      const desc = descRaw ? (Array.isArray(descRaw) ? String(descRaw[0]) : String(descRaw)) : undefined;
      const lang = normalizeLanguage(doc.language);
      const kind = inferKind(mediatype, synthMediaTypes(mediatype));
      return {
        identifier: id,
        archiveUrl: archiveItemLink(id),
        embedUrl: archiveEmbedLink(id),
        title: (titleRaw || id.replace(/[-_]/g, ' ')).slice(0, 300),
        kind,
        mediaTypes: synthMediaTypes(mediatype),
        mediatype,
        thumbnail: archiveThumbLink(id),
        creator: creator?.slice(0, 200),
        date: date?.slice(0, 100),
        year: toYear(dateRaw, undefined),
        language: lang,
        description: desc ? stripHtml(String(desc)).slice(0, 600) : undefined,
        collection: identifier ?? undefined,
        subjectHint: (() => {
          const s = doc.subject;
          if (!s) return undefined;
          const first = Array.isArray(s) ? String(s[0]) : String(s);
          return first.split(';')[0].trim().slice(0, 100);
        })(),
      };
    });

    const kindsSummary: Record<string, number> = {};
    for (const it of results) kindsSummary[it.kind] = (kindsSummary[it.kind] ?? 0) + 1;

    const title = (meta.title ? (Array.isArray(meta.title) ? meta.title[0] : meta.title) : identifier) as string;
    const description = normalizeDescription(meta.description);

    return {
      sourceUrl: sourceUrl.trim(),
      identifier,
      title: String(title).slice(0, 300),
      description,
      totalItems: Math.min(numFound, MAX_ITEMS) || results.length,
      items: results,
      fetchedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      isCollection: true,
      isSingleItem: false,
      provider: 'archive',
      kindsSummary,
    };
  } else {
    // Check for file-level bulk: single archive item with many distinct files (e.g. CollectionOfIslamicBooks with 8 PDFs, RenewingOurIntentions with many MP3s)
    const fileLevel = generateFileLevelItems(metaRes, identifier);
    if (fileLevel && fileLevel.length > 1) {
      const kindsSummary: Record<string, number> = {};
      for (const it of fileLevel) kindsSummary[it.kind] = (kindsSummary[it.kind] ?? 0) + 1;
      const meta = metaRes.metadata || {};
      const titleRaw: any = meta.title;
      const title = Array.isArray(titleRaw) ? titleRaw[0] : (titleRaw || identifier);
      const desc = normalizeDescription(meta.description);
      return {
        sourceUrl: sourceUrl.trim(),
        identifier,
        title: String(title).slice(0,300),
        description: desc,
        totalItems: fileLevel.length,
        items: fileLevel,
        fetchedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        isCollection: true,
        isSingleItem: false,
        provider: 'archive',
        kindsSummary,
      };
    }
    // single item fallback
    const single = normalizeSingle(metaRes);
    return {
      sourceUrl: sourceUrl.trim(),
      identifier,
      title: single.title,
      description: single.description,
      totalItems: 1,
      items: [single],
      fetchedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      isCollection: false,
      isSingleItem: true,
      provider: 'archive',
      kindsSummary: { [single.kind]: 1 },
    };
  }
}
