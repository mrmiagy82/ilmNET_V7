/**
 * File-type detection for admin uploads (Fase 5.3).
 *
 * Why this exists: the upload endpoint used the *client-supplied* `Content-Type` of the multipart
 * part to decide whether a file is an image. A client can claim `image/png` for anything — an HTML
 * page, a zip, a script — and the file would be stored under a `.png` name and served from our own
 * origin. With `x-content-type-options: nosniff` the browser will not sniff it into HTML, but the
 * stored bytes should still be what they claim to be, and a `.png` that is not a PNG breaks the
 * thumbnails on the public site without anyone noticing.
 *
 * The check reads the leading bytes ("magic bytes") and returns the type that is *actually* there.
 * No dependency: the signatures are a handful of constants. The detected type decides the stored
 * extension and the reported mime — the client header is only used to produce a helpful error.
 */

export type ImageType = {
  /** Canonical mime type, e.g. `image/png`. */
  mime: string;
  /** Extension including the dot, e.g. `.png`. */
  ext: string;
  /** Human readable label for error messages. */
  label: string;
};

/** Bytes needed to recognise every supported format (ISO-BMFF brand sits at offset 8). */
export const IMAGE_SNIFF_BYTES = 32;

const JPEG: ImageType = { mime: 'image/jpeg', ext: '.jpg', label: 'JPEG' };
const PNG: ImageType = { mime: 'image/png', ext: '.png', label: 'PNG' };
const GIF: ImageType = { mime: 'image/gif', ext: '.gif', label: 'GIF' };
const WEBP: ImageType = { mime: 'image/webp', ext: '.webp', label: 'WebP' };
const AVIF: ImageType = { mime: 'image/avif', ext: '.avif', label: 'AVIF' };

function startsWith(buf: Buffer, bytes: number[]): boolean {
  if (buf.length < bytes.length) return false;
  return bytes.every((b, i) => buf[i] === b);
}

function asciiAt(buf: Buffer, offset: number, text: string): boolean {
  if (buf.length < offset + text.length) return false;
  return buf.toString('latin1', offset, offset + text.length) === text;
}

/**
 * Detect the real image type from the leading bytes of a file.
 * Returns `null` when the bytes are not one of the five types the CMS supports
 * (jpg, png, webp, gif, avif — the same list `./storage.ts` advertises).
 */
export function detectImageType(head: Buffer): ImageType | null {
  if (!head?.length) return null;
  // JPEG: FF D8 FF (start of image + first marker)
  if (startsWith(head, [0xff, 0xd8, 0xff])) return JPEG;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return PNG;
  // GIF: "GIF87a" / "GIF89a"
  if (asciiAt(head, 0, 'GIF87a') || asciiAt(head, 0, 'GIF89a')) return GIF;
  // WebP: "RIFF" <size> "WEBP"
  if (asciiAt(head, 0, 'RIFF') && asciiAt(head, 8, 'WEBP')) return WEBP;
  // AVIF: ISO base media file format — "ftyp" box at offset 4, brand at offset 8
  if (asciiAt(head, 4, 'ftyp')) {
    const brand = head.toString('latin1', 8, 12);
    if (brand === 'avif' || brand === 'avis' || brand === 'av01') return AVIF;
  }
  return null;
}

/** The list used in error messages — kept next to the detector so they cannot drift apart. */
export const ACCEPTED_IMAGE_TYPES = ['jpg', 'png', 'webp', 'gif', 'avif'];
