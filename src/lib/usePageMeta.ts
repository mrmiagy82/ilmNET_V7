import { useEffect } from 'react';

/**
 * Per-route document metadata (Fase 5.5).
 *
 * Before this, every route shared the static title/description from index.html — a browser tab, a
 * bookmark and a search result all said the same thing, and sharing a lecture on social media
 * produced no card at all. This hook keeps the head in sync with the route that is on screen:
 * title, description, canonical, Open Graph and Twitter tags, plus `noindex` for the admin.
 *
 * Deliberate choices:
 *  - No dependency: plain DOM updates on tagged elements (`data-meta="page"`), so the values are
 *    replaced rather than stacked. Everything the app does not touch (favicon, manifest, the
 *    defaults in index.html) stays as it is.
 *  - The canonical URL is origin + *pathname only*: `/lectures?subject=tawheed` is a filtered view
 *    of `/lectures`, not a page of its own.
 *  - `og:image` is only emitted when the caller has a real image URL. A default social card still
 *    has to be designed, and inventing one here would be a fake asset.
 *  - Indexing is never blocked by default; only pages that explicitly pass `noindex` (the admin)
 *    get a robots meta tag.
 */
const SITE_NAME = 'ilmNet';
const SITE_TITLE = 'ilmNet — A quiet library for Islamic knowledge';
const SITE_DESCRIPTION =
  'A free, no-login library of Islamic lectures, books and scholarship — linking to the original source.';

export interface PageMetaInput {
  /** `og:type`; detail pages use `article`. */
  type?: 'website' | 'article';
  /** Page title; the site name is appended automatically unless it is already the site title. */
  title?: string;
  description?: string;
  /** Canonical path; defaults to the current pathname. Pass '' to skip the canonical link. */
  path?: string;
  /** Absolute or root-relative image URL for social cards. */
  image?: string | null;
  /** Keep this route out of search engines (admin, edit forms, error states). */
  noindex?: boolean;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    el.setAttribute('data-meta', 'page');
    document.head.appendChild(el);
  }
  if (el.getAttribute('content') !== content) el.setAttribute('content', content);
}

function removeMeta(attr: 'name' | 'property', key: string) {
  document.head.querySelector(`meta[${attr}="${key}"]`)?.remove();
}

function upsertCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    el.setAttribute('data-meta', 'page');
    document.head.appendChild(el);
  }
  if (el.getAttribute('href') !== href) el.setAttribute('href', href);
}

/** Root-relative URLs (uploads, /favicon.svg) become absolute; social crawlers reject relative ones. */
function absolute(url: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${window.location.origin}${path}`;
}

function truncate(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const atWord = cut.slice(0, cut.lastIndexOf(' '));
  return `${(atWord.length > max * 0.6 ? atWord : cut).trimEnd()}…`;
}

export function usePageMeta({ title, description, type = 'website', path, image, noindex }: PageMetaInput) {
  useEffect(() => {
    const fullTitle = !title || title === SITE_TITLE ? SITE_TITLE : `${title} · ${SITE_NAME}`;
    const desc = truncate(description || SITE_DESCRIPTION);
    const canonicalPath = path ?? window.location.pathname;
    const canonical = `${window.location.origin}${canonicalPath}`;

    document.title = fullTitle;
    upsertMeta('name', 'description', desc);
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', desc);
    upsertMeta('property', 'og:site_name', SITE_NAME);
    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', desc);

    if (image) {
      const src = absolute(image);
      upsertMeta('property', 'og:image', src);
      upsertMeta('name', 'twitter:image', src);
    } else {
      removeMeta('property', 'og:image');
      removeMeta('name', 'twitter:image');
    }

    if (canonicalPath) upsertCanonical(canonical);

    if (noindex) upsertMeta('name', 'robots', 'noindex, nofollow');
    else removeMeta('name', 'robots');

    // Title/description on their own are not enough for crawlers that do not run JavaScript, but
    // index.html already carries the site defaults for those.
  }, [title, description, type, path, image, noindex]);
}
