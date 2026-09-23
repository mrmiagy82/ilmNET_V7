import { assetUrl, isCustomMediaUrl, type BackendContent } from '@/lib/api';

/**
 * Media (thumbnail / cover) priority for the public site:
 *
 *   1. custom upload from the Admin CMS  (/uploads/<file> or data:image/...)
 *   2. provider thumbnail                (YouTube i.ytimg.com, Archive cover/thumb, Google Books)
 *   3. ilmNet placeholder                (AudioPlaceholder for audio, gradient/letter fallback for books)
 *
 * Never a black Archive.org service thumbnail for audio.
 */

export type MediaKind = 'image' | 'placeholder-audio' | 'placeholder-generic';

export type MediaResolution = {
  src: string | null;
  kind: MediaKind;
  /** Where the winning image came from — useful for tests and admin previews. */
  source: 'custom' | 'provider' | 'none';
};

function providerThumbnail(c: BackendContent): string | null {
  const md: any = c.metadata ?? {};
  const youtube = md?.youtube?.thumbnail;
  if (c.provider === 'youtube' && typeof youtube === 'string' && youtube.trim()) return youtube.trim();
  const archive = md?.archive?.thumbnail ?? md?.archive?.item?.thumbnail;
  if (c.provider === 'archive' && typeof archive === 'string' && archive.trim()) return archive.trim();
  const generic = md?.thumbnail ?? md?.image;
  if (typeof generic === 'string' && generic.trim()) return generic.trim();
  return null;
}

/** true only for thumbnails we may actually render (never the black Archive audio placeholder) */
export function isUsableThumbnail(c: BackendContent): boolean {
  return resolveThumbnail(c).src !== null;
}

export function resolveThumbnail(c: BackendContent): MediaResolution {
  const custom = c.thumbnailUrl?.trim() ?? '';
  if (isCustomMediaUrl(custom)) {
    return { src: assetUrl(custom), kind: 'image', source: 'custom' };
  }

  // Provider thumbnail always beats the stored thumbnail if it is the known-black archive service image for audio
  const stored = custom && custom.includes('archive.org/services/img') && c.type === 'audio' ? '' : custom;
  if (stored) return { src: assetUrl(stored), kind: 'image', source: 'provider' };

  const provider = providerThumbnail(c);
  if (provider) {
    const isBlackArchive = provider.includes('archive.org/services/img') && c.type === 'audio';
    if (!isBlackArchive) return { src: assetUrl(provider), kind: 'image', source: 'provider' };
  }

  return {
    src: null,
    kind: c.type === 'audio' ? 'placeholder-audio' : 'placeholder-generic',
    source: 'none',
  };
}

export function resolveCover(c: BackendContent): MediaResolution {
  const custom = c.coverUrl?.trim() ?? '';
  if (isCustomMediaUrl(custom)) {
    return { src: assetUrl(custom), kind: 'image', source: 'custom' };
  }

  if (custom) return { src: assetUrl(custom), kind: 'image', source: 'provider' };

  // Books: metadata cover (Archive / Google Books) before falling back to the thumbnail
  const md: any = c.metadata ?? {};
  const metaCover = md?.cover ?? md?.archive?.cover ?? md?.googleBooks?.thumbnail;
  if (typeof metaCover === 'string' && metaCover.trim()) return { src: assetUrl(metaCover), kind: 'image', source: 'provider' };

  const thumb = resolveThumbnail(c);
  if (thumb.src) return thumb;

  return { src: null, kind: 'placeholder-generic', source: 'none' };
}

/** Book covers prefer coverUrl, everything else prefers thumbnail */
export function resolveCardMedia(c: BackendContent): MediaResolution {
  const isBook = c.type === 'book' || c.type === 'document';
  return isBook ? resolveCover(c) : resolveThumbnail(c);
}

export function getEffectiveThumbnail(c: BackendContent): string | null {
  return resolveThumbnail(c).src;
}
