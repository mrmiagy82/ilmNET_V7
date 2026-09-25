import fs from 'fs';
import path from 'path';
import type { FastifyInstance } from 'fastify';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { MAX_UPLOAD_BYTES, ensureUploadsDir, getUploadsDir, listUploadFiles } from '../lib/storage';
import { ACCEPTED_IMAGE_TYPES, IMAGE_SNIFF_BYTES, detectImageType } from '../lib/image-type';

// Kept for backwards compatibility with existing imports (tests, docs).
export const UPLOADS_DIR = getUploadsDir();

/**
 * Read the leading bytes of a stream without losing them: the returned `body` yields the peeked
 * bytes again, followed by everything that is left, so the file can still be written in one pass
 * (Fase 5.3 — the mime type is decided by the content, not by the client).
 */
async function peekStream(
  stream: AsyncIterable<Buffer>,
  max: number,
): Promise<{ head: Buffer; body: Readable }> {
  const iterator = stream[Symbol.asyncIterator]();
  const chunks: Buffer[] = [];
  let total = 0;
  while (total < max) {
    const { value, done } = await iterator.next();
    if (done) break;
    if (value?.length) {
      chunks.push(value);
      total += value.length;
    }
  }
  const buffered = Buffer.concat(chunks);
  const head = buffered.subarray(0, max);
  async function* remainder(): AsyncGenerator<Buffer> {
    // Everything that was read must reach the destination again — including the bytes that were
    // only inspected. (Forgetting them truncated every stored image by the peek length.)
    if (buffered.length) yield buffered;
    for (;;) {
      const { value, done } = await iterator.next();
      if (done) return;
      if (value?.length) yield value as Buffer;
    }
  }
  return { head, body: Readable.from(remainder()) };
}

/**
 * Admin media uploads — used by the Admin CMS to attach a custom thumbnail / cover
 * to a Content record. The returned URL is stored in Content.thumbnailUrl / Content.coverUrl
 * and always takes priority over provider thumbnails on the public site.
 *
 * All endpoints live under /api/admin/uploads and are protected by the admin hook in `server.ts`
 * (a signed-in operator's session cookie, plus the legacy token only when it is enabled).
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

    // Fase 5.3: the declared Content-Type is a claim, the bytes are the fact. Read the head of the
    // stream, recognise the format there, and only then decide the extension and the stored mime.
    const { head, body } = await peekStream(file.file as AsyncIterable<Buffer>, IMAGE_SNIFF_BYTES);
    if (!head.length) {
      body.resume();
      return reply.code(400).send({ error: { code: 'EMPTY_FILE', message: 'Uploaded file is empty.' } });
    }
    const detected = detectImageType(head);
    if (!detected) {
      // Drain and throw away what was already read so the request can be answered cleanly.
      body.resume();
      return reply.code(415).send({
        error: {
          code: 'UNSUPPORTED_TYPE',
          message:
            `The uploaded bytes are not a supported image (declared type: ${file.mimetype || 'none'}). ` +
            `Allowed: ${ACCEPTED_IMAGE_TYPES.join(', ')}.`,
        },
      });
    }

    const stamp = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    const base = (path.basename(file.filename || 'image', path.extname(file.filename || '')) || 'image')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .slice(0, 60);
    const filename = `${base}-${stamp}${rand}${detected.ext}`;
    const dest = path.join(ensureUploadsDir(), filename);

    try {
      await pipeline(body, fs.createWriteStream(dest));
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
        // The detected type, not the client's claim: `uploads.test.ts` and the CMS show this value.
        mime: detected.mime,
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
