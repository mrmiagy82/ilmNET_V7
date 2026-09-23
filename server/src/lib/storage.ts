import fs from 'fs';
import path from 'path';

/**
 * Upload storage for admin media (custom thumbnails / covers).
 *
 * Resolution order:
 *   1. UPLOADS_DIR env var  → use for deployments with a mounted volume (e.g. /var/lib/ilmnet/uploads)
 *   2. <server>/uploads     → local dev default (gitignored, .gitkeep keeps the folder in git)
 *
 * In production this directory MUST be a persistent volume: the database only stores
 * the relative path "/uploads/<file>", so a container without a volume would silently
 * lose every custom image on redeploy.
 */

const DEFAULT_DIR = path.resolve(__dirname, '..', '..', 'uploads');

export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

export function getUploadsDir(): string {
  const custom = process.env.UPLOADS_DIR?.trim();
  return custom ? path.resolve(custom) : DEFAULT_DIR;
}

export function ensureUploadsDir(): string {
  const dir = getUploadsDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function isUploadsDirWritable(): boolean {
  try {
    const dir = ensureUploadsDir();
    const probe = path.join(dir, `.write-test-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

export type UploadFile = { filename: string; url: string; bytes: number; modifiedAt: string };

export function listUploadFiles(): UploadFile[] {
  const dir = ensureUploadsDir();
  return fs
    .readdirSync(dir)
    .filter((f) => !f.startsWith('.') && IMAGE_EXTENSIONS.includes(path.extname(f).toLowerCase()))
    .map((f) => {
      const stat = fs.statSync(path.join(dir, f));
      return { filename: f, url: `/uploads/${f}`, bytes: stat.size, modifiedAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

export type StorageHealth = {
  dir: string;
  writable: boolean;
  files: number;
  bytes: number;
  /** true when UPLOADS_DIR points outside the default folder (a mounted volume) */
  custom: boolean;
};

export function uploadsHealth(): StorageHealth {
  const dir = getUploadsDir();
  let files = 0;
  let bytes = 0;
  try {
    for (const f of listUploadFiles()) {
      files++;
      bytes += f.bytes;
    }
  } catch {
    /* directory missing or unreadable — reported through writable/files */
  }
  return { dir, writable: isUploadsDirWritable(), files, bytes, custom: Boolean(process.env.UPLOADS_DIR?.trim()) };
}

/**
 * Compare the /uploads/... paths referenced by content with the files actually on disk.
 * Used at boot so a missing volume is visible immediately instead of silently showing
 * broken thumbnails on the public site.
 */
export async function auditUploadReferences(prisma: {
  content: { findMany: (args: any) => Promise<any[]> };
}): Promise<{ referenced: number; missing: string[]; orphan: number }> {
  const rows = await prisma.content.findMany({
    where: {
      OR: [{ thumbnailUrl: { startsWith: '/uploads/' } }, { coverUrl: { startsWith: '/uploads/' } }],
    },
    select: { thumbnailUrl: true, coverUrl: true },
  });

  const referenced = new Set<string>();
  for (const r of rows as { thumbnailUrl: string | null; coverUrl: string | null }[]) {
    for (const u of [r.thumbnailUrl, r.coverUrl]) {
      if (u?.startsWith('/uploads/')) referenced.add(path.basename(u));
    }
  }

  let onDisk: string[] = [];
  try {
    onDisk = listUploadFiles().map((f) => f.filename);
  } catch {
    onDisk = [];
  }

  const diskSet = new Set(onDisk);
  const missing = [...referenced].filter((f) => !diskSet.has(f));
  const orphan = onDisk.filter((f) => !referenced.has(f)).length;
  return { referenced: referenced.size, missing, orphan };
}
