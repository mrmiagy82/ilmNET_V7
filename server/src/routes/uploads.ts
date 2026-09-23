import fs from 'fs';
import path from 'path';
import type { FastifyInstance } from 'fastify';
import { pipeline } from 'stream/promises';

export const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads');

const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function ensureDir() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Admin media uploads — used by the Admin CMS to attach a custom thumbnail / cover
 * to a Content record. The returned URL is stored in Content.thumbnailUrl / Content.coverUrl
 * and always takes priority over provider thumbnails on the public site.
 */
export async function uploadRoutes(app: FastifyInstance) {
  ensureDir();

  app.post('/api/admin/uploads', async (req, reply) => {
    const file = await (req as any).file({ limits: { fileSize: MAX_BYTES } });

    if (!file) {
      return reply.code(400).send({ error: { code: 'NO_FILE', message: 'No file uploaded — send multipart/form-data with field "file".' } });
    }

    const ext = ALLOWED_MIME[file.mimetype];
    if (!ext) {
      return reply.code(415).send({
        error: { code: 'UNSUPPORTED_TYPE', message: `Unsupported image type ${file.mimetype}. Allowed: jpg, png, webp, gif, avif.` },
      });
    }

    const stamp = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    const base = (path.basename(file.filename || 'image', path.extname(file.filename || '')) || 'image')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .slice(0, 60);
    const filename = `${base}-${stamp}${rand}${ext}`;
    const dest = path.join(UPLOADS_DIR, filename);

    try {
      await pipeline(file.file, fs.createWriteStream(dest));
    } catch (e: any) {
      if (e?.code === 'FST_REQ_FILE_TOO_LARGE' || /file too large/i.test(e?.message ?? '')) {
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        return reply.code(413).send({ error: { code: 'FILE_TOO_LARGE', message: 'Image too large — maximum 5 MB.' } });
      }
      throw e;
    }

    if (file.file.truncated) {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      return reply.code(413).send({ error: { code: 'FILE_TOO_LARGE', message: 'Image too large — maximum 5 MB.' } });
    }
    if (file.file.bytesRead === 0) {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      return reply.code(400).send({ error: { code: 'EMPTY_FILE', message: 'Uploaded file is empty.' } });
    }

    const stat = fs.statSync(dest);
    return reply.code(201).send({
      data: {
        url: `/uploads/${filename}`,
        filename,
        bytes: stat.size,
        mime: file.mimetype,
      },
    });
  });

  app.delete('/api/admin/uploads/:filename', async (req, reply) => {
    const { filename } = req.params as { filename: string };
    const safe = path.basename(filename);
    const target = path.join(UPLOADS_DIR, safe);
    if (!target.startsWith(UPLOADS_DIR) || !fs.existsSync(target)) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: `Upload ${safe} not found` } });
    }
    fs.unlinkSync(target);
    return reply.send({ data: { deleted: safe } });
  });

  app.get('/api/admin/uploads', async () => {
    ensureDir();
    const files = fs
      .readdirSync(UPLOADS_DIR)
      .filter((f) => !f.startsWith('.') && /\.(jpe?g|png|webp|gif|avif)$/i.test(f))
      .map((f) => {
        const stat = fs.statSync(path.join(UPLOADS_DIR, f));
        return { filename: f, url: `/uploads/${f}`, bytes: stat.size, modifiedAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    return { data: files };
  });
}
