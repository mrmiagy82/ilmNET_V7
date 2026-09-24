import fs from 'fs';
import path from 'path';
import type { FastifyInstance } from 'fastify';
import { pipeline } from 'stream/promises';
import {
  ALLOWED_IMAGE_MIME,
  MAX_UPLOAD_BYTES,
  ensureUploadsDir,
  getUploadsDir,
  listUploadFiles,
} from '../lib/storage';

// Kept for backwards compatibility with existing imports (tests, docs).
export const UPLOADS_DIR = getUploadsDir();

/**
 * Admin media uploads — used by the Admin CMS to attach a custom thumbnail / cover
 * to a Content record. The returned URL is stored in Content.thumbnailUrl / Content.coverUrl
 * and always takes priority over provider thumbnails on the public site.
 *
 * All endpoints live under /api/admin/uploads and are protected by the admin token hook.
 */
export async function uploadRoutes(app: FastifyInstance) {
  ensureUploadsDir();

  app.post('/api/admin/uploads', async (req, reply) => {
    // Reject everything that is not a multipart upload with a clear 400 (not the plugin's 406)
    if (!(req as any).isMultipart || !(req as any).isMultipart()) {
      return reply.code(400).send({
        error: { code: 'NO_FILE', message: 'Expected multipart/form-data with an image in the "file" field.' },
      });
    }

    let file: any;
    try {
      file = await (req as any).file({ limits: { fileSize: MAX_UPLOAD_BYTES } });
    } catch (e: any) {
      return reply.code(400).send({ error: { code: 'BAD_UPLOAD', message: e?.message || 'Could not read the uploaded file.' } });
    }

    if (!file) {
      return reply.code(400).send({ error: { code: 'NO_FILE', message: 'No file uploaded — send multipart/form-data with field "file".' } });
    }

    const ext = ALLOWED_IMAGE_MIME[file.mimetype];
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
    const dest = path.join(ensureUploadsDir(), filename);

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
    // Strict: only the plain filenames this API generates (no separators, no '..', no dotfiles,
    // no percent-encodings). A path-like value is rejected instead of being silently reduced to
    // its basename, so a traversal attempt can never target something inside the uploads dir.
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(filename) || filename.includes('..')) {
      return reply.code(400).send({
        error: { code: 'INVALID_FILENAME', message: 'Invalid upload filename.' },
      });
    }
    const dir = ensureUploadsDir();
    const target = path.join(dir, filename);
    // defence in depth: never leave the uploads directory, only delete regular files
    if (path.dirname(target) !== dir || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: `Upload ${filename} not found` } });
    }
    fs.unlinkSync(target);
    return reply.send({ data: { deleted: filename } });
  });

  app.get('/api/admin/uploads', async () => {
    return { data: listUploadFiles() };
  });
}
