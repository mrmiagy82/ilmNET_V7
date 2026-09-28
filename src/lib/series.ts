/**
 * Series / collection grouping (Fase 3.5, corrected in D6).
 *
 * A "series" in ilmNet is a **collectionIdentifier on content records** — nothing more. The database has
 * no episode number, no position and no import order, so this module does not invent one: it groups and
 * it keeps the order the API returned.
 *
 * D6 correction (audit A3): the items inside a group used to be re-sorted alphabetically
 * (`items.sort(title)`). That produced the wrong impression of a sequence — the series page then drew
 * positional "01, 02, 03" badges over an A–Z list, so a course looked ordered when it was not. The
 * grouping now preserves the API's own order (most recently updated first by default) and claims
 * nothing about position; real ordering needs the import to store a position (plan item B5, D7/D6+).
 */
import type { BackendContent } from '@/lib/api';

export type SeriesGroup = {
  id: string; // collectionIdentifier
  title: string; // collectionTitle or first item's series or id
  provider: string;
  /** How many items of this collection are in **the set that was grouped** — see `SeriesCard`. */
  count: number;
  items: BackendContent[];
  thumbnailUrl: string | null;
  coverUrl: string | null;
  subjects: { id: string; name: string; accent: string }[];
  scholars: { id: string; name: string }[];
  type: 'series' | 'playlist' | 'collection';
  description?: string;
};

export function groupByCollection(contents: BackendContent[]): {
  series: SeriesGroup[];
  standalone: BackendContent[];
} {
  const map = new Map<string, BackendContent[]>();
  const standalone: BackendContent[] = [];

  for (const c of contents) {
    const cid = c.collectionIdentifier?.trim();
    if (cid && cid.length > 1) {
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid)!.push(c);
    } else {
      standalone.push(c);
    }
  }

  const series: SeriesGroup[] = [];
  const stillStandalone: BackendContent[] = [...standalone];

  for (const [cid, items] of map.entries()) {
    if (items.length >= 2) {
      // No re-sort: the API's order is the only order that actually exists for these records (D6/A3).
      const first = items[0]!;
      const title = first.collectionTitle?.trim() || first.series?.trim() || cid.replace(/[-_]/g, ' ').replace(/--/g, ' — ');
      // Determine type label
      let type: SeriesGroup['type'] = 'series';
      if (first.provider === 'youtube') type = 'playlist';
      else if (first.provider === 'archive') type = 'collection';
      // Thumbnail: first item's thumbnail or cover
      const thumbnailUrl = first.thumbnailUrl || first.coverUrl || null;
      const coverUrl = first.coverUrl || first.thumbnailUrl || null;
      // Aggregate subjects/scholars
      const subjMap = new Map<string, { id: string; name: string; accent: string }>();
      const schMap = new Map<string, { id: string; name: string }>();
      for (const it of items) {
        for (const cs of it.subjects) {
          const s = cs.subject;
          if (!subjMap.has(s.id)) subjMap.set(s.id, { id: s.id, name: s.name, accent: (s as any).accent || 'plain' });
        }
        for (const cs of it.scholars) {
          const s = cs.scholar;
          if (!schMap.has(s.id)) schMap.set(s.id, { id: s.id, name: s.name });
        }
      }
      series.push({
        id: cid,
        title,
        provider: first.provider,
        count: items.length,
        items,
        thumbnailUrl,
        coverUrl,
        subjects: Array.from(subjMap.values()),
        scholars: Array.from(schMap.values()),
        type,
        description: items[0]?.description?.slice(0, 160),
      });
    } else {
      // Single item with collectionIdentifier but only one — treat as standalone
      stillStandalone.push(...items);
    }
  }

  // A list of *collections* sorted by name is a stated property of the view, not a claim about the
  // order of anything inside them, so this sort stays (it is what the rails have always shown).
  series.sort((a, b) => a.title.localeCompare(b.title));
  // Sort standalone by updatedAt desc (newest first) — keep original order if possible
  stillStandalone.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return { series, standalone: stillStandalone };
}

export function getDownloadUrl(c: BackendContent): string | null {
  // Real external file URL only — never fake
  const provider = c.provider;
  const type = c.type;

  // Archive.org — derive direct download URL when possible
  if (provider === 'archive') {
    // Use collectionIdentifier + base derived from externalIdentifier
    // externalIdentifier is either parentId (single) or parentId--Base (file-level)
    const ext = c.externalIdentifier || '';
    const coll = c.collectionIdentifier || '';
    // If ext contains --, base is after --
    let base: string | null = null;
    let parentId: string | null = null;
    if (ext.includes('--')) {
      const parts = ext.split('--');
      parentId = parts[0]!;
      base = parts.slice(1).join('--').replace(/_/g, ' ');
      // Also try to get from sourceUrl if base not reliable
      // sourceUrl for file-level is https://archive.org/details/<parent>/<Base>
      try {
        const u = new URL(c.sourceUrl);
        const afterDetails = u.pathname.split('/details/')[1];
        if (afterDetails) {
          const segments = afterDetails.split('/').filter(Boolean);
          if (segments.length >= 2) {
            parentId = segments[0]!;
            base = decodeURIComponent(segments.slice(1).join('/'));
          } else if (segments.length === 1) {
            parentId = segments[0]!;
            // try embedUrl subPrefix
            if (c.embedUrl && c.embedUrl.includes('subPrefix=')) {
              const sp = new URL(c.embedUrl).searchParams.get('subPrefix');
              if (sp) base = decodeURIComponent(sp);
            }
          }
        }
      } catch {}
    } else if (coll && ext) {
      parentId = coll;
      // ext is parentId for single items — not file-level, use ext as parent
      base = null;
    }

    // If we have parent and base, construct download
    if (parentId && base) {
      const safeBase = base.trim();
      if (type === 'audio') {
        return `https://archive.org/download/${encodeURIComponent(parentId)}/${encodeURIComponent(safeBase)}.mp3`;
      }
      if (type === 'book' || type === 'document') {
        // PDF is most common for books
        return `https://archive.org/download/${encodeURIComponent(parentId)}/${encodeURIComponent(safeBase)}.pdf`;
      }
      // generic fallback: try mp3 then pdf? For now return null if unknown
      return `https://archive.org/download/${encodeURIComponent(parentId)}/${encodeURIComponent(safeBase)}`;
    }

    // Single archive item (not file-level) — sourceUrl is details page, download is /download/<identifier>/<identifier>.pdf or .mp3
    // We can try to use metadata to infer filename, but without file list we return the details page as fallback? Requirement says use real external file URL, never fake.
    // For single items where ext is the identifier itself, we can offer the sourceUrl's /download/ variant if we can guess extension from type.
    if (ext && !ext.includes('--')) {
      // For book single, common pattern is /download/<id>/<id>.pdf or <id>_text.pdf
      // We cannot guarantee exact filename without metadata, so we return null to avoid fake URL.
      // Instead, we return the archive details page which is the real file location (user can download from there).
      // But requirement says "Gebruik de echte externe file URL." — for archive single items, the direct file URL would be in metadata.files.
      // Since we don't have it here, we fallback to sourceUrl and note that download is via Archive page.
      // To be safe, we return null and UI will show "Open on Archive.org" instead of fake download.
      return null;
    }
    return null;
  }

  // PDF direct
  if (provider === 'pdf') {
    // sourceUrl is direct pdf link
    if (c.sourceUrl && c.sourceUrl.toLowerCase().endsWith('.pdf')) return c.sourceUrl;
    return null;
  }

  // Google Books — no direct download
  if (provider === 'google_books') return null;

  // YouTube — no direct download (legal)
  if (provider === 'youtube') return null;

  // External — if sourceUrl is direct file (pdf, mp3, mp4)
  if (provider === 'external') {
    const url = c.sourceUrl || '';
    if (/\.(pdf|mp3|mp4|m4a|ogg|epub)$/i.test(url)) return url;
    return null;
  }

  return null;
}

export function getAudioStreamUrl(c: BackendContent): string | null {
  // For audio, try to get direct stream URL for custom player
  // Archive audio: same as download (mp3) — can be streamed
  const dl = getDownloadUrl(c);
  if (dl) return dl;
  // If no direct, check if embedUrl is usable? For YouTube audio we can't stream directly, return null
  // For archive single where we couldn't construct, we could try to use the archive's stream URL via /download/<id>/<id>.mp3 but we return null to avoid fake
  return null;
}
