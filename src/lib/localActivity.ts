/**
 * Device-local activity (Discovery step D5).
 *
 * This is the **only** module in the frontend that touches `localStorage`. Every other file goes
 * through the handful of functions below, so the rules live in one place instead of being spread over
 * the detail pages (owner instruction for D5, §1).
 *
 * What is kept, and what is deliberately not:
 *   - an entry holds a **content id** (its address in the library), the **slug** (to build the link
 *     without asking the API), a **kind** ('media' | 'book' | 'audio'), the **timestamp** of the last
 *     open, and — for audio only — the **real playback position and duration** the player reported.
 *   - no title, no description, no scholar, no subject, no query history, no search terms, no
 *     identifier of the person: those are either not necessary or belong to the API, and the detail
 *     page must load the *current* data anyway (owner instruction §4, plan §8 D5).
 *   - nothing is sent anywhere. There is no account, no sync, no server call from this file; the only
 *     network access in D5 is the existing public API, used by `useLocalActivity` to check that a
 *     remembered item still exists.
 *
 * The plan left this feature behind owner decision Q1 ("device-local history: yes/no"). The D5
 * instruction answers it **yes**, with the boundaries above and with a visible way to wipe it.
 *
 * Robustness (the storage is a shared, hostile place):
 *   - every read/write is wrapped: a browser that refuses storage (private mode, quota, a disabled
 *     permission) simply behaves as if nothing had been remembered;
 *   - unreadable, truncated or hand-edited data is discarded **and removed**, never thrown;
 *   - entries whose fields are missing or of the wrong type are dropped individually;
 *   - old entries expire (see `ACTIVITY_RETENTION_MS`) and the list is capped.
 *
 * No dependency, no React, no DOM beyond `localStorage`: the pure functions at the top are the part
 * the unit suite (`tests/e2e/local-activity.spec.mjs`) exercises directly.
 */

/** What the remembered item is. Decides the detail route and whether a playback position applies. */
export type ActivityKind = 'media' | 'book' | 'audio';

export type ActivityEntry = {
  /** content id — the key a detail page is opened with */
  id: string;
  /** content slug — enough to build the detail URL without a request */
  slug: string;
  kind: ActivityKind;
  /** epoch ms of the last open (or the last playback update for audio) */
  lastOpenedAt: number;
  /** real playback position in seconds (audio only, only when the player reported one) */
  positionSec?: number;
  /** real duration in seconds (audio only, only when the player knew it) */
  durationSec?: number;
};

/** Versioned key: a future shape change must not be read as this one. */
export const ACTIVITY_STORAGE_KEY = 'ilmnet.local-activity.v1';

/** How many entries are kept. The Continue rail shows a handful; a cap keeps the value small. */
export const MAX_ACTIVITY_ENTRIES = 20;

/** Entries older than this are dropped on the next read (kept simple and documented, not clever). */
export const ACTIVITY_RETENTION_MS = 120 * 24 * 60 * 60 * 1000;

/** Below this, "resume" would be noise: a few seconds in is not a position worth offering. */
export const MIN_RESUME_SECONDS = 20;

/** Near the end, resuming is noise too — and it is the one place a stale position could look wrong. */
export const MIN_REMAINING_SECONDS = 20;

/** Maps a content type onto the three kinds this module distinguishes. */
export function kindForType(type: string): ActivityKind {
  if (type === 'book' || type === 'document') return 'book';
  if (type === 'audio') return 'audio';
  return 'media';
}

/** The canonical detail route for a remembered item (the library's own link form). */
export function detailPathFor(kind: ActivityKind, slug: string): string {
  return `${kind === 'book' ? '/books' : '/lectures'}/${encodeURIComponent(slug)}`;
}

const KINDS: ActivityKind[] = ['media', 'book', 'audio'];

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Turns anything that came out of storage into a valid entry, or `null`.
 *
 * Deliberately strict: a recognised shape with the right types, nothing else. Unknown extra fields are
 * dropped rather than carried along, so a stale version of this module cannot smuggle data into the
 * next one.
 */
export function sanitiseEntry(value: unknown, now: number = Date.now()): ActivityEntry | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const slug = typeof raw.slug === 'string' ? raw.slug.trim() : '';
  const kind = KINDS.includes(raw.kind as ActivityKind) ? (raw.kind as ActivityKind) : null;
  const lastOpenedAt = finiteNumber(raw.lastOpenedAt);
  if (!id || !slug || !kind || lastOpenedAt === null) return null;
  if (lastOpenedAt <= 0 || lastOpenedAt > now + 60_000) return null; // clock nonsense is not history
  if (now - lastOpenedAt > ACTIVITY_RETENTION_MS) return null;

  const entry: ActivityEntry = { id, slug, kind, lastOpenedAt };
  const positionSec = finiteNumber(raw.positionSec);
  const durationSec = finiteNumber(raw.durationSec);
  // A position is only meaningful together with the duration it belongs to.
  if (positionSec !== null && positionSec >= 0 && durationSec !== null && durationSec > 0) {
    entry.positionSec = positionSec;
    entry.durationSec = durationSec;
  }
  return entry;
}

/** Parses the stored JSON. Corrupt, truncated or foreign data yields an empty list — never a throw. */
export function parseActivity(raw: string | null | undefined, now: number = Date.now()): ActivityEntry[] {
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const entries = parsed.map((item) => sanitiseEntry(item, now)).filter((e): e is ActivityEntry => e !== null);
  return sortAndCap(entries);
}

export function serializeActivity(entries: ActivityEntry[]): string {
  return JSON.stringify(entries);
}

/** Most recent first, no duplicates (the first occurrence wins) and never longer than the cap. */
export function sortAndCap(entries: ActivityEntry[], cap: number = MAX_ACTIVITY_ENTRIES): ActivityEntry[] {
  const seen = new Set<string>();
  const unique: ActivityEntry[] = [];
  for (const entry of [...entries].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    unique.push(entry);
    if (unique.length >= cap) break;
  }
  return unique;
}

/**
 * Inserts or updates one entry and moves it to the front.
 *
 * The playback position of the *same* content is replaced, not merged: the newest real position is the
 * only one that can be resumed honestly. When the same content is opened again without a playback
 * update, an existing real position is kept (you open an audio page, you have not lost your place).
 */
export function upsertActivity(entries: ActivityEntry[], entry: ActivityEntry): ActivityEntry[] {
  const previous = entries.find((e) => e.id === entry.id);
  const merged: ActivityEntry = {
    ...entry,
    positionSec: entry.positionSec ?? previous?.positionSec,
    durationSec: entry.durationSec ?? previous?.durationSec,
  };
  return sortAndCap([merged, ...entries.filter((e) => e.id !== entry.id)]);
}

/**
 * The position worth restoring, or `null`.
 *
 * Returns `null` unless the entry is about **this** content, is an **audio** entry, and carries a real
 * position inside the real duration with enough left to be worth continuing. Each of those conditions
 * exists to stop one wrong claim: a stale entry, another item's entry, a lecture or book that was never
 * played, a hand-edited store, or a position in the last seconds of a file being offered as "continue".
 */
export function resumePointFor(
  entry: ActivityEntry | null | undefined,
  contentId: string,
): { positionSec: number; durationSec: number } | null {
  if (!entry || entry.id !== contentId) return null;
  if (entry.kind !== 'audio') return null; // a position only ever belongs to an audio item (§5, §6)
  const position = finiteNumber(entry.positionSec);
  const duration = finiteNumber(entry.durationSec);
  if (position === null || duration === null || duration <= 0) return null;
  if (position < MIN_RESUME_SECONDS) return null;
  if (position > duration - MIN_REMAINING_SECONDS) return null;
  return { positionSec: Math.floor(position), durationSec: Math.floor(duration) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage adapter — the only place that talks to `localStorage`.
// ─────────────────────────────────────────────────────────────────────────────

function storage(): Storage | null {
  try {
    const store = (globalThis as { localStorage?: Storage }).localStorage;
    return store ?? null;
  } catch {
    // Some browsers throw on *access* when storage is blocked; that is not an error for the visitor.
    return null;
  }
}

/** True when this device can remember anything at all (used to keep the UI honest about it). */
export function storageAvailable(): boolean {
  const store = storage();
  if (!store) return false;
  try {
    const probe = `${ACTIVITY_STORAGE_KEY}.probe`;
    store.setItem(probe, '1');
    store.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function readActivity(now: number = Date.now()): ActivityEntry[] {
  const store = storage();
  if (!store) return [];
  let raw: string | null = null;
  try {
    raw = store.getItem(ACTIVITY_STORAGE_KEY);
  } catch {
    return [];
  }
  if (raw === null) return [];
  const entries = parseActivity(raw, now);
  if (entries.length === 0) {
    // Unreadable or entirely expired: an empty list is the answer, and the dead value is removed so it
    // cannot be re-parsed on every page view.
    try {
      store.removeItem(ACTIVITY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  return entries;
}

function writeActivity(entries: ActivityEntry[]): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(ACTIVITY_STORAGE_KEY, serializeActivity(sortAndCap(entries)));
  } catch {
    // Full quota or blocked storage: the site keeps working, the visit is simply not remembered.
  }
}

/** Remembers that this device opened a content page. Returns the stored entry, or `null`. */
export function recordOpen(
  { id, slug, type }: { id: string; slug: string; type: string },
  now: number = Date.now(),
): ActivityEntry | null {
  if (!id || !slug) return null;
  const entry: ActivityEntry = { id, slug, kind: kindForType(type), lastOpenedAt: now };
  const next = upsertActivity(readActivity(now), entry);
  writeActivity(next);
  return next.find((e) => e.id === id) ?? null;
}

/**
 * Remembers a **real** playback position reported by the audio element.
 *
 * Refuses to store anything it cannot stand behind: a non-positive position, a missing or zero
 * duration, or a position past the end of the file (which would be a lie dressed up as progress).
 */
export function recordPlayback(
  { id, slug, positionSec, durationSec }: { id: string; slug: string; positionSec: number; durationSec: number },
  now: number = Date.now(),
): ActivityEntry | null {
  if (!id || !slug) return null;
  if (!Number.isFinite(positionSec) || !Number.isFinite(durationSec)) return null;
  if (durationSec <= 0 || positionSec < 0 || positionSec > durationSec) return null;
  const entry: ActivityEntry = {
    id,
    slug,
    kind: 'audio',
    lastOpenedAt: now,
    positionSec,
    durationSec,
  };
  const next = upsertActivity(readActivity(now), entry);
  writeActivity(next);
  return next.find((e) => e.id === id) ?? null;
}

/** The entry for one content id, or `null` (this is what the audio player asks for). */
export function getActivityEntry(id: string, now: number = Date.now()): ActivityEntry | null {
  return readActivity(now).find((e) => e.id === id) ?? null;
}

/** Forgets a single id — used when the API says that content no longer exists. */
export function forgetActivity(id: string): void {
  const next = readActivity().filter((e) => e.id !== id);
  if (next.length === 0) {
    clearActivity();
    return;
  }
  writeActivity(next);
}

/**
 * Wipes everything this device remembered. The visible "clear" action calls exactly this; there is no
 * second path, and no other storage key is involved.
 */
export function clearActivity(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(ACTIVITY_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
