export type PublishStatus = 'published' | 'draft' | 'archived';
export type SubjectGroup = 'Revelation' | 'Practice' | 'Belief' | 'History' | 'Language' | 'Character';
export type Accent = 'rose' | 'olive' | 'plain';
export type LectureFormat = 'Audio' | 'Video';
export type LectureLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type BookFormat = 'Translation' | 'Commentary' | 'Primer' | 'Classical';

export type LectureSourceType = 'youtube-video' | 'youtube-playlist';
export type BookSourceType = 'archive' | 'external' | 'google-books' | 'pdf';

// — New generic architecture: providers & content types —
// Source provider: where the file is hosted
export type SourceProvider = 'youtube' | 'archive' | 'external' | 'google-books' | 'pdf';
// Generic content type the admin assigns after detection
export type ArchiveContentType = 'lecture' | 'book' | 'audio' | 'video' | 'document';
// Raw Archive.org kind as detected from metadata
export type ArchiveItemKind = 'audio' | 'video' | 'book' | 'document' | 'collection' | 'unknown';

export interface AdminLecture {
  id: string;
  title: string;
  youtubeUrl: string; // kept for backwards compat — for youtube provider this is the canonical url, for archive provider may be empty and sourceUrl used
  sourceType?: LectureSourceType;
  // new generic provider fields
  provider?: SourceProvider;
  sourceUrl?: string;
  archiveIdentifier?: string;
  mediaTypes?: string[];
  scholarId: string;
  scholarIds?: string[];
  subjectIds: string[];
  description: string;
  series: string;
  format: LectureFormat;
  level: LectureLevel;
  durationMin: number;
  episodes: number;
  status: PublishStatus;
  updatedAt: string;
  thumbnailUrl?: string;
  coverUrl?: string;
  language?: string;
  tags?: string[];
}

export interface AdminBook {
  id: string;
  title: string;
  archiveUrl: string;
  sourceUrl?: string;
  sourceType?: BookSourceType;
  provider?: SourceProvider;
  archiveIdentifier?: string;
  mediaTypes?: string[];
  scholarId: string;
  scholarIds?: string[];
  subjectIds: string[];
  description: string;
  format: BookFormat;
  pages: number;
  year: number;
  status: PublishStatus;
  updatedAt: string;
  coverUrl?: string;
  publisher?: string;
  language?: string;
  isbn?: string;
  tags?: string[];
}

export interface AdminScholar {
  id: string;
  name: string;
  initials: string;
  specialtyId: string;
  bio: string;
  accent: 'rose' | 'olive';
  status: PublishStatus;
  updatedAt: string;
}

export interface AdminSubject {
  id: string;
  name: string;
  group: SubjectGroup;
  description: string;
  accent: Accent;
  status: PublishStatus;
  updatedAt: string;
}

export interface Activity {
  id: string;
  at: string;
  verb: 'Added' | 'Updated' | 'Published' | 'Unpublished' | 'Removed';
  kind: 'lecture' | 'book' | 'scholar' | 'subject';
  title: string;
}

export const subjectGroups: SubjectGroup[] = ['Revelation', 'Belief', 'Practice', 'History', 'Language', 'Character'];
export const lectureFormats: LectureFormat[] = ['Audio', 'Video'];
export const lectureLevels: LectureLevel[] = ['Beginner', 'Intermediate', 'Advanced'];
export const bookFormats: BookFormat[] = ['Translation', 'Commentary', 'Primer', 'Classical'];

export const lectureSourceOptions: { value: LectureSourceType; label: string; hint: string }[] = [
  { value: 'youtube-video', label: 'YouTube · Single video', hint: 'One talk, one khutbah, one lesson' },
  { value: 'youtube-playlist', label: 'YouTube · Full playlist', hint: 'A course or series collected as a playlist' },
];

export const bookSourceOptions: { value: BookSourceType; label: string; hint: string }[] = [
  { value: 'archive', label: 'Archive.org', hint: 'Scanned manuscript or published edition on archive.org' },
  { value: 'external', label: 'External document', hint: 'Publisher site, PDF, or other hosted document' },
  { value: 'google-books', label: 'Google Books', hint: 'Preview or full view on books.google.com' },
  { value: 'pdf', label: 'Direct PDF', hint: 'A direct .pdf link hosted elsewhere' },
];

// New generic provider options (for lectures now that archive is generic)
export const lectureProviderOptions: { value: SourceProvider; label: string; hint: string }[] = [
  { value: 'youtube', label: 'YouTube', hint: 'Single video or playlist — remains fully supported' },
  { value: 'archive', label: 'Archive.org', hint: 'Audio, video, document or collection — bulk-capable' },
  { value: 'external', label: 'External URL', hint: 'Other hosted audio/video' },
];

export const archiveContentTypeOptions: { value: ArchiveContentType; label: string; hint: string }[] = [
  { value: 'lecture', label: 'Lecture', hint: 'A taught session — audio or video' },
  { value: 'audio', label: 'Audio', hint: 'Audio recording / recitation' },
  { value: 'video', label: 'Video', hint: 'Video recording' },
  { value: 'book', label: 'Book', hint: 'Text edition / manuscript' },
  { value: 'document', label: 'Document', hint: 'PDF / article / document' },
];

// — Archive.org generic bulk-import types —

export interface ArchiveDetectedItem {
  identifier: string;
  archiveUrl: string;
  embedUrl: string;
  title: string;
  kind: ArchiveItemKind;
  mediaTypes: string[]; // e.g. ['MP3', 'Ogg Vorbis', 'MPEG4']
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

export interface ArchiveCollectionResult {
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
}

export interface ArchiveImportDraft {
  detected: ArchiveDetectedItem;
  selected: boolean;
  customTitle: string;
  customDescription: string;
  contentType: ArchiveContentType;
  scholarIds: string[];
  subjectIds: string[];
  language: string;
  series: string;
  category: string;
  status: PublishStatus | 'skip';
}






export function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export function todayStamp() {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '•';
  const skip = new Set(['shaykh', 'shaykha', 'dr.', 'dr', 'ustadh', 'ustadha', 'imam']);
  const core = parts.filter((p) => !skip.has(p.toLowerCase()));
  const use = (core.length ? core : parts).slice(0, 2);
  return use.map((w) => w[0]!.toUpperCase()).join('');
}

// — URL helpers —

export function isYoutubeUrl(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host === 'youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com');
  } catch {
    return false;
  }
}

export function isYoutubePlaylistUrl(url: string) {
  try {
    const u = new URL(url);
    return u.searchParams.has('list');
  } catch {
    return false;
  }
}

export function isYoutubeVideoUrl(url: string) {
  try {
    if (!isYoutubeUrl(url)) return false;
    const u = new URL(url);
    if (u.hostname.replace(/^www\./, '') === 'youtu.be') return true;
    if (u.searchParams.has('v')) return true;
    if (u.pathname.startsWith('/embed/')) return true;
    if (u.pathname.startsWith('/shorts/')) return true;
    if (u.pathname.includes('/playlist') && u.searchParams.has('list') && !u.searchParams.has('v')) return false;
    return !isYoutubePlaylistUrl(url) || u.searchParams.has('v');
  } catch {
    return false;
  }
}

export function isArchiveUrl(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host === 'archive.org' || host.endsWith('.archive.org');
  } catch {
    return false;
  }
}

export function isGoogleBooksUrl(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host === 'books.google.com' || host.endsWith('.google.com');
  } catch {
    return false;
  }
}

export function isPdfUrl(url: string) {
  try {
    const u = new URL(url);
    return u.pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return url.trim().toLowerCase().endsWith('.pdf');
  }
}

export function isExternalBookUrl(url: string) {
  if (!url.trim()) return false;
  try {
    const u = new URL(url);
    return ['http:', 'https:'].includes(u.protocol);
  } catch {
    return false;
  }
}

export function detectLectureSource(url: string): LectureSourceType | null {
  if (!isYoutubeUrl(url)) return null;
  return isYoutubePlaylistUrl(url) && !new URL(url).searchParams.has('v') ? 'youtube-playlist' : 'youtube-video';
}

export function detectBookSource(url: string): BookSourceType | null {
  if (!url.trim()) return null;
  if (isArchiveUrl(url)) return 'archive';
  if (isGoogleBooksUrl(url)) return 'google-books';
  if (isPdfUrl(url)) return 'pdf';
  if (isExternalBookUrl(url)) return 'external';
  return null;
}

export function detectProvider(url: string): SourceProvider | null {
  if (isYoutubeUrl(url)) return 'youtube';
  if (isArchiveUrl(url)) return 'archive';
  if (!url.trim()) return null;
  try {
    const u = new URL(url);
    if (['http:', 'https:'].includes(u.protocol)) return 'external';
  } catch {}
  return null;
}

// Embed URL builders
export function getYoutubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      if (!id) return null;
      const list = u.searchParams.get('list');
      if (list) return `https://www.youtube.com/embed/${id}?list=${list}`;
      return `https://www.youtube.com/embed/${id}`;
    }
    const v = u.searchParams.get('v');
    const list = u.searchParams.get('list');
    if (u.pathname.startsWith('/embed/')) {
      return url;
    }
    if (u.pathname.startsWith('/shorts/')) {
      const id = u.pathname.split('/')[2];
      return `https://www.youtube.com/embed/${id}`;
    }
    if (u.pathname.includes('/playlist') && list && !v) {
      return `https://www.youtube.com/embed/videoseries?list=${list}`;
    }
    if (v) {
      if (list) return `https://www.youtube.com/embed/${v}?list=${list}`;
      return `https://www.youtube.com/embed/${v}`;
    }
    if (list) {
      return `https://www.youtube.com/embed/videoseries?list=${list}`;
    }
    return null;
  } catch {
    return null;
  }
}

export function getArchiveEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!isArchiveUrl(url)) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('details');
    if (idx !== -1 && parts[idx + 1]) {
      return `https://archive.org/embed/${parts[idx + 1]}`;
    }
    if (parts.length === 1) {
      return `https://archive.org/embed/${parts[0]}`;
    }
    if (parts[0] === 'embed') return url;
    return null;
  } catch {
    return null;
  }
}

export function getGoogleBooksEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const id = u.searchParams.get('id');
    if (!id) return null;
    return `https://books.google.com/books?id=${id}&printsec=frontcover&hl=en`;
  } catch {
    return null;
  }
}

export function getBookEmbedUrl(url: string, type: BookSourceType | null): string | null {
  if (!url.trim()) return null;
  const t = type ?? detectBookSource(url);
  if (t === 'archive') return getArchiveEmbedUrl(url);
  if (t === 'google-books') return getGoogleBooksEmbedUrl(url);
  if (t === 'pdf') return url;
  return null;
}

export function youtubeThumbnail(url: string): string | null {
  try {
    const embed = getYoutubeEmbedUrl(url);
    if (!embed) return null;
    const idMatch = embed.match(/\/embed\/([^?]+)/);
    if (idMatch?.[1] && idMatch[1] !== 'videoseries') {
      return `https://img.youtube.com/vi/${idMatch[1]}/hqdefault.jpg`;
    }
    return null;
  } catch {
    return null;
  }
}

// — Generic Archive.org helpers —

export function parseArchiveIdentifier(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (!isArchiveUrl(url)) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    // /details/<id>
    const idx = parts.indexOf('details');
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];
    // /embed/<id>
    if (parts[0] === 'embed' && parts[1]) return parts[1];
    // /search.php?query=...
    if (u.pathname.includes('search')) return u.searchParams.get('query')?.split(' ')[0] ?? null;
    // single segment like /details/
    if (parts.length === 1) return parts[0];
    // collection like /details/<collection>/...
    return parts[0] ?? null;
  } catch {
    return null;
  }
}

export function archiveItemLink(identifier: string): string {
  return `https://archive.org/details/${identifier}`;
}

export function archiveEmbedLink(identifier: string): string {
  return `https://archive.org/embed/${identifier}`;
}

export function inferArchiveItemKind(mediaTypes: string[]): ArchiveItemKind {
  const s = mediaTypes.join(' ').toLowerCase();
  if (s.includes('mp3') || s.includes('ogg') || s.includes('flac') || s.includes('audio')) return 'audio';
  if (s.includes('mpeg4') || s.includes('h.264') || s.includes('video') || s.includes('mp4')) return 'video';
  if (s.includes('pdf') || s.includes('djvu') || s.includes('text')) return 'book';
  if (s.includes('collection')) return 'collection';
  return 'unknown';
}

export function inferContentTypeFromKind(kind: ArchiveItemKind): ArchiveContentType {
  if (kind === 'audio') return 'audio';
  if (kind === 'video') return 'video';
  if (kind === 'book') return 'book';
  if (kind === 'collection') return 'lecture';
  return 'document';
}

export type YouTubeItemKind = 'video' | 'playlist' | 'unknown';

export interface YouTubeDetectedItem {
  identifier: string; // videoId
  youtubeUrl: string;
  embedUrl: string;
  title: string;
  kind: YouTubeItemKind;
  mediaTypes: string[];
  mediatype?: string;
  thumbnail?: string;
  creator?: string;
  channelId?: string;
  date?: string;
  year?: number;
  language?: string;
  description?: string;
  collection?: string; // playlistId if part of playlist
  subjectHint?: string;
  duration?: string; // e.g. "3:55" or "1:02:15"
  size?: string;
  publisher?: string;
  publishedAt?: string;
  channelTitle?: string;
}

export interface YouTubeCollectionResult {
  sourceUrl: string;
  identifier: string; // videoId or playlistId
  title: string;
  description?: string;
  totalItems: number;
  items: YouTubeDetectedItem[];
  fetchedAt: string;
  isCollection: boolean;
  isSingleItem: boolean;
  provider: 'youtube';
  kindsSummary: Record<string, number>;
  collectionTitle?: string;
  channelTitle?: string;
}

export interface YouTubeImportDraft {
  detected: YouTubeDetectedItem;
  selected: boolean;
  customTitle: string;
  customDescription: string;
  contentType: ArchiveContentType; // reuse generic types: video/audio/lecture etc
  scholarIds: string[];
  subjectIds: string[];
  language: string;
  series: string;
  category: string;
  status: PublishStatus | 'skip';
}

// Helper for youtube URL helpers already defined above — also expose parse helpers
export function parseYouTubeIdentifier(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    const playlistId = u.searchParams.get('list');
    if (playlistId) return playlistId;
    if (host === 'youtu.be') {
      const parts = u.pathname.split('/').filter(Boolean);
      return parts[0] || null;
    }
    const v = u.searchParams.get('v');
    if (v) return v;
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] === 'shorts' && parts[1]) return parts[1];
    if (parts[0] === 'embed' && parts[1]) return parts[1].split('?')[0];
    return null;
  } catch { return null; }
}

export function getYouTubeEmbedUrl(url: string): string | null {
  const id = parseYouTubeIdentifier(url);
  if (!id) return null;
  try {
    const u = new URL(url);
    if (u.searchParams.has('list') && !u.searchParams.has('v')) {
      const list = u.searchParams.get('list');
      return `https://www.youtube.com/embed/videoseries?list=${list}`;
    }
  } catch {}
  // individual video embed
  // Detect playlist vs video by param
  if (url.includes('playlist?list=') || url.includes('&list=')) {
    // for preview display, we still use playlist embed for collection?
    try {
      const u2 = new URL(url);
      const list = u2.searchParams.get('list');
      const v = u2.searchParams.get('v');
      if (list && !v) return `https://www.youtube.com/embed/videoseries?list=${list}`;
      if (v) return `https://www.youtube.com/embed/${v}`;
    } catch {}
  }
  // fallback single
  return `https://www.youtube.com/embed/${id}`;
}
