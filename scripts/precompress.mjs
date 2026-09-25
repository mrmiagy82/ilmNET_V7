#!/usr/bin/env node
/**
 * Fase 5.4 — write `dist/index.html.gz` next to the build.
 *
 * The whole app is inlined into one `index.html` (~646 kB) by `vite-plugin-singlefile`, and until now
 * every visitor downloaded that uncompressed: no dependency in the API could fix it (Fastify has no
 * built-in compression), and the built-in `preCompressed` support of `@fastify/static` needs a `.gz`
 * file on disk. This script produces it with `node:zlib` — no dependency, a few milliseconds.
 *
 * `npm run build` runs it automatically, so the two files are always written together; a deployment
 * that copies `index.html` alone still works (the server then serves the uncompressed file).
 */
import { gzipSync } from 'node:zlib';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexFile = join(root, 'dist', 'index.html');

if (!existsSync(indexFile)) {
  console.warn('[precompress] dist/index.html not found — run `npm run build`; nothing to compress.');
  process.exit(0);
}

const source = readFileSync(indexFile);
const gz = gzipSync(source, { level: 9 });
writeFileSync(`${indexFile}.gz`, gz);

const fresh = statSync(`${indexFile}.gz`).mtimeMs >= statSync(indexFile).mtimeMs;
const kb = (n) => (n / 1024).toFixed(2);
console.log(
  `[precompress] dist/index.html ${kb(source.length)} kB → gzip ${kb(gz.length)} kB ` +
    `(${(100 - (gz.length / source.length) * 100).toFixed(0)}% smaller)${fresh ? '' : ' — WARNING: the .gz is older than index.html'}`,
);
