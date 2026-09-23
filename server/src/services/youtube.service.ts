/**
 * YouTube provider service — pure provider logic, no generic Content CRUD.
 * Isolated from archive.service.ts and from generic Content routes.
 * Used by import routes for preview & confirm.
 */

const YOUTUBE_ORIGIN = 'https://www.youtube.com';
const FETCH_TIMEOUT_MS = 7000;
const MAX_ITEMS = 100;

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'ilmNet/1.0 (youtube-preview; +https://ilmnet.example)', ...headers },
    });
    if (!res.ok) throw new Error(`YouTube ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchHtml(url: string, headers: Record<string, string> = {}): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...headers,
      },
    });
    if (!res.ok) throw new Error(`YouTube ${res.status} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

// ── URL parsing ──
export interface ParsedYouTube {
  videoId: string | null;
  playlistId: string | null;
  isPlaylist: boolean;
  isVideo: boolean;
}

export function parseYouTubeUrl(sourceUrl: string): ParsedYouTube | null {
  try {
    const u = new URL(sourceUrl.trim());
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    const isYT = host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be' || host === 'youtube-nocookie.com' || host.endsWith('.youtube-nocookie.com');
    if (!isYT && !sourceUrl.includes('youtube.com') && !sourceUrl.includes('youtu.be')) return null;

    let videoId: string | null = null;
    let playlistId: string | null = u.searchParams.get('list');

    // youtu.be/<id>
    if (host === 'youtu.be') {
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0]) videoId = parts[0].split('?')[0].split('#')[0].split('&')[0];
      // also check list param already captured
      return { videoId, playlistId, isPlaylist: !!playlistId, isVideo: !!videoId && !playlistId };
    }

    // youtube.com/*
    const parts = u.pathname.split('/').filter(Boolean);
    // /watch?v=...
    if (parts[0] === 'watch') {
      videoId = u.searchParams.get('v');
    } else if (parts[0] === 'shorts' && parts[1]) {
      videoId = parts[1].split('?')[0];
    } else if (parts[0] === 'embed' && parts[1]) {
      videoId = parts[1].split('?')[0];
    } else if (parts[0] === 'v' && parts[1]) {
      videoId = parts[1].split('?')[0];
    } else if (parts[0] === 'live' && parts[1]) {
      videoId = parts[1].split('?')[0];
    } else if (parts[0] === 'playlist' && playlistId) {
      // keep playlistId
    }
    // fallback: if no videoId but URL contains v param
    if (!videoId) {
      const v = u.searchParams.get('v');
      if (v) videoId = v;
    }

    // clean videoId (11 chars typical, but allow 11)
    if (videoId) {
      videoId = videoId.split('?')[0].split('&')[0].split('/')[0];
      // basic validation: YouTube IDs are 11 chars [a-zA-Z0-9_-]
      if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        // allow if longer? some shorts may be 11 still, but if not 11, keep but will fail later
        // we keep as is, but if obviously invalid (too short), treat as null
        if (videoId.length < 5) videoId = null;
      }
    }
    if (playlistId) {
      playlistId = playlistId.split('&')[0].split('#')[0];
      // playlist IDs start with PL, OL, UU, RD, etc and are longer; basic check
      if (playlistId.length < 2) playlistId = null;
    }

    if (!videoId && !playlistId) return null;

    const isPlaylist = !!playlistId;
    const isVideo = !!videoId && !isPlaylist;

    return { videoId, playlistId, isPlaylist, isVideo };
  } catch {
    return null;
  }
}

export function isYouTubeUrl(url: string): boolean {
  return parseYouTubeUrl(url) !== null;
}

export function youtubeVideoLink(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
export function youtubeEmbedLink(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}
export function youtubePlaylistEmbedLink(playlistId: string): string {
  return `https://www.youtube.com/embed/videoseries?list=${playlistId}`;
}
export function youtubeThumbLink(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
export function youtubePlaylistLink(playlistId: string): string {
  return `https://www.youtube.com/playlist?list=${playlistId}`;
}

// ── Duration helpers — reuse archive parser logic ──
import { parseDurationToMinutes } from './archive.service.js';

function safeUnescapeJsonString(s: string): string {
  try {
    return JSON.parse(`"${s}"`);
  } catch {
    return s.replace(/\\u0026/g, '&').replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\//g, '/').replace(/\\\\/g, '\\');
  }
}

function formatDurationFromSeconds(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── YouTube detected item shape ──
export type YouTubeItemKind = 'video' | 'playlist' | 'unknown';
export interface YouTubeDetectedItem {
  identifier: string; // videoId for items, playlistId for playlist itself
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
  publisher?: string; // channel name
  publishedAt?: string;
}

export interface YouTubePreview {
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

// ── Helpers to parse watch page ──
function extractJsonVar(html: string, varName: string): any | null {
  // pattern: var varName = {...};
  const re = new RegExp(`${varName}\\s*=\\s*(\\{[\\s\\S]+?\\});`);
  const m = html.match(re);
  if (!m) return null;
  try {
    return JSON.parse(m[1]!);
  } catch {
    // try to find balanced braces via counting? fallback regex may be incomplete due to early ;
    // Instead try to find via "ytInitialPlayerResponse = " and then locate matching braces manually
    return null;
  }
}

function extractBalancedJson(html: string, marker: string): any | null {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  const start = html.indexOf('{', idx);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
    } else {
      if (ch === '"') inString = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(html.slice(start, i + 1));
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
}

function parseWatchPage(html: string, videoId: string): { title: string; description?: string; thumbnail?: string; creator?: string; channelId?: string; publishDate?: string; lengthSeconds?: number; durationStr?: string } | null {
  const player = extractBalancedJson(html, 'ytInitialPlayerResponse');
  if (!player) return null;
  const videoDetails = player.videoDetails || {};
  const microformat = player.microformat?.playerMicroformatRenderer || {};

  // playability check
  const playability = player.playabilityStatus?.status;
  if (playability && playability !== 'OK') {
    // e.g. ERROR, LOGIN_REQUIRED, UNPLAYABLE
    const reason = player.playabilityStatus?.reason || playability;
    // allow embed playable? but if not OK, treat as not found
    if (playability === 'ERROR' || playability === 'UNPLAYABLE') {
      return null;
    }
  }

  const title = videoDetails.title || microformat.title?.simpleText || videoDetails.title || 'Untitled';
  const lengthSeconds = videoDetails.lengthSeconds ? parseInt(String(videoDetails.lengthSeconds), 10) : (microformat.lengthSeconds ? parseInt(String(microformat.lengthSeconds), 10) : undefined);
  const durationStr = lengthSeconds ? formatDurationFromSeconds(lengthSeconds) : undefined;
  const thumbnail = videoDetails.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  const creator = videoDetails.author || microformat.ownerChannelName || player.videoDetails?.author || undefined;
  const channelId = videoDetails.channelId || microformat.externalChannelId || undefined;
  const publishDate = microformat.publishDate || microformat.uploadDate || undefined;
  const description = videoDetails.shortDescription || microformat.description?.simpleText || undefined;

  return {
    title: String(title).slice(0, 300),
    description: description ? String(description).slice(0, 900) : undefined,
    thumbnail,
    creator: creator ? String(creator).slice(0, 200) : undefined,
    channelId,
    publishDate: publishDate ? String(publishDate) : undefined,
    lengthSeconds,
    durationStr,
  };
}

async function fetchVideoMetadata(videoId: string): Promise<YouTubeDetectedItem | null> {
  // Try oEmbed first (fast)
  let oEmbedTitle: string | undefined;
  let oEmbedThumb: string | undefined;
  let oEmbedAuthor: string | undefined;
  try {
    const oembed = await fetchJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`);
    oEmbedTitle = oembed.title;
    oEmbedThumb = oembed.thumbnail_url;
    oEmbedAuthor = oembed.author_name;
  } catch {
    // ignore, will try watch page
  }

  // Fetch watch page for full metadata
  try {
    const html = await fetchHtml(`https://www.youtube.com/watch?v=${videoId}`);
    const parsed = parseWatchPage(html, videoId);
    if (parsed) {
      const effectiveTitle = (parsed.title && parsed.title !== 'Untitled' && parsed.title.trim().length > 1) ? parsed.title : (oEmbedTitle || parsed.title || videoId);
      return {
        identifier: videoId,
        youtubeUrl: youtubeVideoLink(videoId),
        embedUrl: youtubeEmbedLink(videoId),
        title: effectiveTitle || oEmbedTitle || videoId,
        kind: 'video',
        mediaTypes: ['YouTube Video'],
        mediatype: 'video',
        thumbnail: parsed.thumbnail || oEmbedThumb || youtubeThumbLink(videoId),
        creator: parsed.creator || oEmbedAuthor,
        channelId: parsed.channelId,
        date: parsed.publishDate,
        year: parsed.publishDate ? parseInt(String(parsed.publishDate).slice(0, 4), 10) || undefined : undefined,
        description: parsed.description,
        duration: parsed.durationStr,
        publisher: parsed.creator,
        publishedAt: parsed.publishDate,
      };
    }
  } catch (e) {
    // fallback to oEmbed if watch failed
  }

  if (oEmbedTitle) {
    return {
      identifier: videoId,
      youtubeUrl: youtubeVideoLink(videoId),
      embedUrl: youtubeEmbedLink(videoId),
      title: oEmbedTitle.slice(0, 300),
      kind: 'video',
      mediaTypes: ['YouTube Video'],
      mediatype: 'video',
      thumbnail: oEmbedThumb || youtubeThumbLink(videoId),
      creator: oEmbedAuthor,
      publisher: oEmbedAuthor,
    };
  }

  return null;
}

async function fetchPlaylistPage(playlistId: string): Promise<{ title: string; description?: string; channel?: string; videos: Array<{ videoId: string; title?: string; duration?: string; thumbnail?: string; creator?: string }> }> {
  const html = await fetchHtml(`https://www.youtube.com/playlist?list=${playlistId}`);

  // Playlist title & description from playlistMetadataRenderer
  let title = playlistId;
  let description: string | undefined;
  let channel: string | undefined;

  // Playlist title & description - try robust extraction
  try {
    const titleMatch = html.match(/"playlistMetadataRenderer":\{"title":"((?:[^"\\]|\\.)+)"(?:,"description":"((?:[^"\\]|\\.)*)")?/);
    if (titleMatch) {
      if (titleMatch[1]) title = safeUnescapeJsonString(titleMatch[1]);
      if (titleMatch[2]) description = safeUnescapeJsonString(titleMatch[2]);
    } else {
      const pageTitle = html.match(/<title>([^<]+)<\/title>/);
      if (pageTitle) title = pageTitle[1].replace(' - YouTube', '').trim().slice(0, 300);
    }
  } catch {
    const pageTitle = html.match(/<title>([^<]+)<\/title>/);
    if (pageTitle) title = pageTitle[1].replace(' - YouTube', '').trim().slice(0, 300);
  }

  // Try to get channel from microformat or header
  const ownerMatch = html.match(/"ownerText":\{"runs":\[{"text":"([^"]+)"}/);
  if (ownerMatch) channel = ownerMatch[1];

  // Extract videos via lockupViewModel
  const videos: Array<{ videoId: string; title?: string; duration?: string; thumbnail?: string; creator?: string }> = [];
  const seen = new Set<string>();

  // Find all lockupViewModel blocks
  const lockupRe = /"lockupViewModel":\{/g;
  let m: RegExpExecArray | null;
  while ((m = lockupRe.exec(html)) !== null) {
    const start = m.index;
    const snippet = html.slice(start, start + 15000); // large enough to capture block

    // videoId via watchEndpoint
    const vidMatch = snippet.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    if (!vidMatch) continue;
    const vid = vidMatch[1]!;
    if (seen.has(vid)) continue;

    // title via lockupMetadataViewModel title content
    let vidTitle: string | undefined;
    const titleM = snippet.match(/"lockupMetadataViewModel":\{"title":\{"content":"((?:[^"\\]|\\.)+)"/);
    if (titleM) vidTitle = safeUnescapeJsonString(titleM[1]);
    else {
      const altTitle = snippet.match(/"content":"((?:[^"\\]|\\.)+)"[^}]*"styleRuns"/);
      if (altTitle) vidTitle = safeUnescapeJsonString(altTitle[1]);
    }

    // duration via thumbnailBadgeViewModel text
    let dur: string | undefined;
    const durMatch = snippet.match(/"thumbnailBadgeViewModel"[\s\S]*?"text":"(\d+:\d+(?::\d+)?)"/);
    if (durMatch) dur = durMatch[1];
    else {
      const dur2 = snippet.match(/"simpleText":"(\d+:\d+(?::\d+)?)"/);
      if (dur2) dur = dur2[1];
    }

    // creator via metadataRows first part
    let creator: string | undefined;
    const creatorMatch = snippet.match(/"metadataRows":\[\{"metadataParts":\[\{"text":\{"content":"((?:[^"\\]|\\.)+)"/);
    if (creatorMatch) creator = safeUnescapeJsonString(creatorMatch[1]);

    // Thumbnail via i.ytimg.com
    const thumbMatch = snippet.match(/"url":"(https:\/\/i\.ytimg\.com\/vi\/[^"]+)"/);
    let thumb: string | undefined = thumbMatch ? thumbMatch[1]!.replace(/\\u0026/g, '&') : undefined;
    if (!thumb) thumb = youtubeThumbLink(vid);

    // Only keep if title looks like video (not playlist header)
    if (vidTitle && vidTitle.length > 2) {
      videos.push({ videoId: vid, title: vidTitle, duration: dur, thumbnail: thumb, creator });
      seen.add(vid);
      if (videos.length >= MAX_ITEMS) break;
    } else if (vid && snippet.includes('"videoId"')) {
      // fallback without title: still include but with placeholder
      videos.push({ videoId: vid, title: vidTitle || vid, duration: dur, thumbnail: thumb, creator });
      seen.add(vid);
      if (videos.length >= MAX_ITEMS) break;
    }
  }

  // Fallback: if lockup parsing gave < 5 videos, also regex generic videoIds
  if (videos.length < 3) {
    const genericIds = [...new Set((html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/g) || []).map((s) => s.match(/"videoId":"([^"]+)"/)![1]!))];
    for (const gid of genericIds) {
      if (seen.has(gid)) continue;
      if (videos.length >= MAX_ITEMS) break;
      // Skip if genericId looks like channel or playlist internal
      if (gid.length !== 11) continue;
      videos.push({ videoId: gid, title: gid, thumbnail: youtubeThumbLink(gid) });
      seen.add(gid);
    }
  }

  return { title: title.slice(0, 300), description: description?.slice(0, 900), channel, videos: videos.slice(0, MAX_ITEMS) };
}

// ── preview orchestration ──
export async function previewYouTube(sourceUrl: string): Promise<YouTubePreview> {
  const parsed = parseYouTubeUrl(sourceUrl);
  if (!parsed) throw new Error(`Cannot parse YouTube identifier from URL: ${sourceUrl}`);

  if (parsed.isPlaylist && parsed.playlistId) {
    const playlistId = parsed.playlistId;
    // Fetch playlist page
    let playlistData: { title: string; description?: string; channel?: string; videos: Array<{ videoId: string; title?: string; duration?: string; thumbnail?: string; creator?: string }> };
    try {
      playlistData = await fetchPlaylistPage(playlistId);
    } catch (e: any) {
      throw new Error(`YouTube playlist not found or unavailable: ${playlistId} (${e.message})`);
    }

    if (!playlistData.videos.length) {
      throw new Error(`YouTube playlist empty or unavailable: ${playlistId}`);
    }

    // Enrich videos with oEmbed/watch if needed for missing titles? But we already have titles from lockup
    // For missing titles (fallback placeholder), try to fetch single video metadata for up to 5 to enrich? But to keep fast, we leave as is
    // Optionally, we could fetch via oEmbed for those with placeholder titles, but not required for preview

    const items: YouTubeDetectedItem[] = playlistData.videos.map((v) => ({
      identifier: v.videoId,
      youtubeUrl: youtubeVideoLink(v.videoId),
      embedUrl: youtubeEmbedLink(v.videoId),
      title: (v.title || v.videoId).slice(0, 300),
      kind: 'video',
      mediaTypes: ['YouTube Video'],
      mediatype: 'video',
      thumbnail: v.thumbnail || youtubeThumbLink(v.videoId),
      creator: v.creator || playlistData.channel,
      date: undefined,
      year: undefined,
      description: undefined,
      collection: playlistId,
      duration: v.duration,
      publisher: v.creator || playlistData.channel,
    }));

    const kindsSummary: Record<string, number> = { video: items.length };

    return {
      sourceUrl: sourceUrl.trim(),
      identifier: playlistId,
      title: playlistData.title,
      description: playlistData.description,
      totalItems: items.length,
      items,
      fetchedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      isCollection: true,
      isSingleItem: false,
      provider: 'youtube',
      kindsSummary,
      collectionTitle: playlistData.title,
      channelTitle: playlistData.channel,
    };
  } else if (parsed.videoId) {
    const videoId = parsed.videoId;
    const item = await fetchVideoMetadata(videoId);
    if (!item) throw new Error(`YouTube video not found: ${videoId} (from ${sourceUrl})`);

    return {
      sourceUrl: sourceUrl.trim(),
      identifier: videoId,
      title: item.title,
      description: item.description,
      totalItems: 1,
      items: [item],
      fetchedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      isCollection: false,
      isSingleItem: true,
      provider: 'youtube',
      kindsSummary: { video: 1 },
      collectionTitle: undefined,
    };
  } else {
    throw new Error(`Cannot parse YouTube identifier from URL: ${sourceUrl}`);
  }
}

// ── fetch single video metadata for confirm (enrich) ──
export async function fetchYouTubeVideoMetadataForConfirm(videoId: string): Promise<YouTubeDetectedItem | null> {
  return fetchVideoMetadata(videoId);
}
