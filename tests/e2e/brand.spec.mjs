/**
 * Fase 6.1 — real vector assets and their existing placements, no database fixtures or auth mocks.
 *
 * npm run build && npm run preview -- --port 4173
 * npm run test:e2e:brand
 * Optional: SITE_URL, BRAND_EVIDENCE_DIR (otherwise a temporary directory outside the checkout).
 *
 * This can run against the static production preview: library/API failure states are left honest.
 * It verifies the real signed-out page and the pure shared BrandLogo component, NOT authenticated
 * CMS behaviour. The production/CMS suites still require a real API, accounts and published data.
 */
import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const SITE = (process.env.SITE_URL || 'http://localhost:4173').replace(/\/$/, '');
const EVIDENCE = process.env.BRAND_EVIDENCE_DIR || await mkdtemp(path.join(tmpdir(), 'ilmnet-brand-'));
await mkdir(EVIDENCE, { recursive: true });
const variants = [
  ['primary-light', 'primary', 450, 150, ['#1F2933', '#CC3A63', '#A2AB73']],
  ['primary-dark', 'primaryDark', 345, 115, ['#FFFFFF', '#CC3A63', '#A2AB73']],
  ['horizontal', 'horizontal', 345, 185, ['#1F2933', '#CC3A63', '#A2AB73']],
  ['stacked', 'stacked', 310, 185, ['#1F2933', '#CC3A63', '#A2AB73']],
  ['small-scale', 'smallScale', 215, 115, ['#1F2933', '#CC3A63', '#A2AB73']],
  ['icon-only', 'iconOnly', 210, 185, ['#1F2933', '#CC3A63', '#A2AB73']],
  ['monochrome-dark', 'monochromeDark', 310, 115, ['#1F2933']],
  ['monochrome-light', 'monochromeLight', 280, 115, ['#FFFFFF']],
];
let passed = 0;
function check(condition, label) {
  assert.ok(condition, label);
  passed++;
  console.log(`✓ ${label}`);
}
const report = { site: SITE, assets: [], placements: [], scope: 'Vector/branding smoke only; no authenticated CMS or database verification.' };
const browser = await chromium.launch();
try {
  let page = await browser.newPage();
  for (const [name, , width, height, colors] of variants) {
    const file = `ilmnet-logo-${name}.svg`;
    const source = await readFile(path.join(ROOT, 'public/brand/logo', file), 'utf8');
    const built = await readFile(path.join(ROOT, 'dist/brand/logo', file), 'utf8');
    check(source === built, `${name}: production build contains the exact SVG`);
    const res = await page.goto(`${SITE}/brand/logo/${file}`);
    check(res.status() === 200 && /image\/svg\+xml/.test(res.headers()['content-type'] || ''), `${name}: served as image/svg+xml`);
    check(await res.text() === source, `${name}: HTTP delivers the real file, not an HTML fallback`);
    const structure = await page.evaluate(() => {
      const svg = document.documentElement;
      const all = [svg, ...svg.querySelectorAll('*')];
      return {
        root: svg.localName,
        viewBox: svg.getAttribute('viewBox'),
        width: Number(svg.getAttribute('width')),
        height: Number(svg.getAttribute('height')),
        allowed: all.every((el) => ['svg', 'title', 'desc', 'path'].includes(el.localName)),
        references: all.some((el) => [...el.attributes].some((a) => /href|^on|style/i.test(a.name) || /url\(|data:|base64/i.test(a.value))),
        paths: [...svg.querySelectorAll('path')].map((p) => ({ fill: p.getAttribute('fill'), d: p.getAttribute('d') })),
        title: svg.querySelector('title')?.textContent,
      };
    });
    check(structure.root === 'svg' && structure.viewBox === `0 0 ${width} ${height}` && structure.width === width && structure.height === height,
      `${name}: reference artboard/proportions retained`);
    check(structure.allowed && !structure.references && structure.paths.length > 0,
      `${name}: paths only — no image, text/font, background rect, effect, script or external resource`);
    check(structure.paths.every((p) => p.d && /C/.test(p.d) && /Z/i.test(p.d)) && structure.title?.includes('IlmNet'),
      `${name}: closed vector contours and accessible title`);
    const fills = [...new Set(structure.paths.map((p) => p.fill))].sort();
    check(JSON.stringify(fills) === JSON.stringify([...colors].sort()), `${name}: exact official palette${name.startsWith('monochrome') ? ', truly one colour' : ''}`);

    const asset = { name, width, height, bytes: Buffer.byteLength(source), fills, zooms: [] };
    for (const zoom of [1, 4, 10]) {
      await page.setViewportSize({ width: width * zoom, height: height * zoom });
      await page.evaluate(({ width, height, zoom }) => {
        document.documentElement.setAttribute('width', String(width * zoom));
        document.documentElement.setAttribute('height', String(height * zoom));
      }, { width, height, zoom });
      const alpha = await page.evaluate(async ({ width, height, zoom, file }) => {
        const image = new Image();
        image.src = `/brand/logo/${file}`;
        await image.decode();
        const canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
        canvas.width = width * zoom;
        canvas.height = height * zoom;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let painted = 0, opaque = 0, border = 0;
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const a = data[(y * canvas.width + x) * 4 + 3];
            if (a) painted++;
            if (a === 255) opaque++;
            if ((x === 0 || y === 0 || x === canvas.width - 1 || y === canvas.height - 1) && a) border++;
          }
        }
        return { painted: painted / (canvas.width * canvas.height), opaque, border, naturalWidth: image.naturalWidth };
      }, { width, height, zoom, file });
      check(alpha.naturalWidth === width && alpha.opaque > 0 && alpha.painted > .025 && alpha.painted < .40,
        `${name} @ ${zoom * 100}%: vector renders with transparent negative space (${(alpha.painted * 100).toFixed(1)}% painted)`);
      check(alpha.border === 0, `${name} @ ${zoom * 100}%: all four edges transparent; no presentation rectangle/crop debris`);
      const screenshot = `${name}-${zoom * 100}.png`;
      await page.screenshot({ path: path.join(EVIDENCE, screenshot), omitBackground: true });
      asset.zooms.push({ percent: zoom * 100, ...alpha, screenshot });
    }
    report.assets.push(asset);
  }

  // Render the actual shared component in isolation, without constructing any fake auth context.
  const source = await readFile(path.join(ROOT, 'src/components/Brand.tsx'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(createRequire(import.meta.url), module, module.exports);
  const { BrandLogo } = module.exports;
  const html = await readFile(path.join(ROOT, 'dist/index.html'), 'utf8');
  const styles = [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map((m) => m[0]).join('\n');
  check(styles.length > 0, 'component checks use the real production CSS');
  // Use a fresh blank document, not setContent over a mounted app (its WebGL loop would survive).
  await page.close();
  page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  for (const [name, variant, width, height] of variants) {
    const markup = renderToStaticMarkup(React.createElement(BrandLogo, { variant, className: 'h-11', label: `IlmNet ${name}`, title: 'Vector logo' }));
    await page.setContent(`<!doctype html><html><head><base href="${SITE}/">${styles}</head><body><main>${markup}</main></body></html>`);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
    const img = await page.locator('main img').evaluate((i) => {
      const r = i.getBoundingClientRect();
      return { src: i.currentSrc, width: r.width, height: r.height, alt: i.alt, title: i.title, sources: document.querySelectorAll('picture source').length };
    });
    check(img.src.endsWith(`ilmnet-logo-${name}.svg`) && !img.sources && img.alt === `IlmNet ${name}` && img.title === 'Vector logo',
      `${name}: BrandLogo selects SVG and preserves accessible props`);
    check(Math.abs(img.height - 44) < .1 && Math.abs(img.width - 44 * width / height) < .1,
      `${name}: shared component height sizing has the correct aspect ratio`);
  }

  // Existing header/footer at desktop, narrow mobile and ordinary mobile sizes, including deep URLs.
  const routePaths = ['/', '/lectures', '/books', '/scholars', '/subjects', '/subjects/fiqh'];
  for (const [width, height, mobile] of [[1366, 900, false], [375, 812, true], [320, 740, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
    const app = await context.newPage();
    const errors = [];
    const requested = [];
    app.on('pageerror', (e) => errors.push(e.message));
    app.on('request', (r) => { if (r.url().includes('/brand/logo/')) requested.push(r.url()); });
    for (const route of routePaths) {
      await app.goto(`${SITE}${route}`, { waitUntil: 'domcontentloaded' });
      await app.locator('header a[aria-label="IlmNet home"] img').waitFor();
      await app.locator('footer a[href="/"] img').waitFor();
      await app.waitForFunction(() => [...document.querySelectorAll('img[src*="/brand/logo/"]')].every((i) => i.complete && i.naturalWidth > 0));
      await app.evaluate(() => document.fonts.ready);
      const info = await app.evaluate(() => {
        const image = (selector) => {
          const i = document.querySelector(selector);
          const r = i.getBoundingClientRect();
          return { src: i.currentSrc, width: r.width, height: r.height, alt: i.alt, loaded: i.complete && i.naturalWidth > 0 };
        };
        return {
          header: image('header a[aria-label="IlmNet home"] img'),
          footer: image('footer a[href="/"] img'),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      const label = `${route} @ ${width}px`;
      check([info.header, info.footer].every((i) => i.loaded && i.src.endsWith('/ilmnet-logo-primary-light.svg')), `${label}: header AND footer load SVG`);
      check(Math.abs(info.header.width - (mobile ? 108 : 120)) < .1 && Math.abs(info.header.height - (mobile ? 36 : 40)) < .1,
        `${label}: header retains ${mobile ? '108×36' : '120×40'} layout`);
      check(Math.abs(info.footer.width - 96) < .1 && Math.abs(info.footer.height - 32) < .1, `${label}: footer retains 96×32 layout`);
      check(info.header.alt === '' && info.footer.alt === 'IlmNet', `${label}: named header link/decorative image and footer alt retained`);
      check(info.overflow <= 2, `${label}: no horizontal overflow`);
      report.placements.push({ route, viewport: width, ...info });
      if (route === '/') {
        // A full-page capture includes both placements without scrolling a fixed header into view.
        await app.screenshot({ path: path.join(EVIDENCE, `home-${width}.png`), fullPage: true, animations: 'disabled' });
      }
    }
    await app.goto(`${SITE}/admin`, { waitUntil: 'domcontentloaded' });
    await app.locator('[data-testid="admin-login"] img[src$="ilmnet-logo-stacked.svg"]').waitFor();
    await app.waitForFunction(() => [...document.querySelectorAll('[data-testid="admin-login"] img')].every((i) => i.complete && i.naturalWidth > 0));
    const login = await app.locator('[data-testid="admin-login"] img').first().evaluate((i) => ({ width: i.getBoundingClientRect().width, alt: i.alt }));
    check(Math.abs(login.width - 128) < .1 && login.alt === 'IlmNet', `admin sign-in @ ${width}px: stacked SVG, width sizing and alt retained (no sign-in attempted)`);
    check(requested.length > 0 && requested.every((url) => url.endsWith('.svg')), `@ ${width}px: the UI never requests a PNG/WebP logo fallback`);
    check(errors.length === 0, `@ ${width}px: no uncaught browser errors`);
    await app.screenshot({ path: path.join(EVIDENCE, `admin-login-${width}.png`) });
    await context.close();
  }

  await page.goto(`${SITE}/`);
  const head = await page.evaluate(() => ({
    theme: document.querySelector('meta[name="theme-color"]')?.content,
    icon: document.querySelector('link[rel="icon"][sizes="32x32"]')?.getAttribute('href'),
    apple: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
    manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
  }));
  check(head.theme === '#F3EBDD' && head.icon === '/brand/favicon/favicon-32.png', 'official theme colour and supplied raster favicon unchanged');
  check(head.apple === '/brand/favicon/apple-touch-icon.png' && Boolean(head.manifest), 'Apple icon and manifest retained');
  report.passed = passed;
  await writeFile(path.join(EVIDENCE, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`\n${passed}/${passed} branding checks passed. Evidence: ${EVIDENCE}`);
  console.log('Scope: static production build + pure BrandLogo + real signed-out page; no database/authentication suite claim.');
} catch (error) {
  for (const [index, p] of browser.contexts().flatMap((c) => c.pages()).entries()) {
    console.error('Brand test diagnostic', index, p.url(), await p.evaluate(() => ({
      title: document.title,
      body: document.body?.innerText.slice(0, 900),
      headers: [...document.querySelectorAll('header')].map((h) => ({ html: h.outerHTML.slice(0, 800), box: h.getBoundingClientRect().toJSON() })),
    })).catch((e) => e.message));
    await p.screenshot({ path: path.join(EVIDENCE, `failure-${index}.png`), timeout: 5000 }).catch(() => {});
  }
  throw error;
} finally {
  await browser.close();
}
