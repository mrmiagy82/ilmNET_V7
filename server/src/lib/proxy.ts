/**
 * Proxy trust, client IP and public-origin resolution (Fase 5.2).
 *
 * Why this module exists
 * ----------------------
 * Until Fase 5.2 the server ran with Fastify's `trustProxy: true`. That trusts the
 * `X-Forwarded-*` headers from **any** connection, which means any client can decide what the
 * server believes about its own request:
 *
 *   * `X-Forwarded-For`      → a fake client IP, which feeds the login throttle (`lib/auth.ts`),
 *                              `AdminSession.ip` and the logs;
 *   * `X-Forwarded-Proto`    → claims a request is HTTPS when it is not, so the server would send
 *                              HSTS over plain HTTP;
 *   * `X-Forwarded-Host`     → controls the host the HTTP→HTTPS redirect sends a visitor to
 *                              (an open redirect / phishing vector).
 *
 * The rules implemented here:
 *   R1  `TRUST_PROXY` is the single switch. Default: **false** (trust nothing).
 *       Values: `false|0|off|none` · `true|on|*` · a hop count (`1`) · a comma-separated list of
 *       IPs/CIDRs (`127.0.0.1,10.0.0.0/8`), which is what Fastify calls a trusted-proxy list.
 *   R2  Forwarded headers are only read when `TRUST_PROXY` enables them.
 *   R3  A redirect target is never taken from the request unless the host is on an explicit
 *       allowlist: `PUBLIC_ORIGIN`, the hostnames in `CORS_ORIGIN`, or `ALLOWED_HOSTS`.
 *       `PUBLIC_ORIGIN` (when set) always wins, so the redirect can never be steered at all.
 *   R4  `FORCE_HTTPS=true` without a trusted proxy would redirect in a loop, so `buildApp()`
 *       refuses that combination instead of shipping it (see `assertProxyConfiguration()`).
 */
import { isProduction } from './env';

/** What Fastify accepts for `trustProxy` (a hop *count* is deliberately not supported). */
export type TrustProxyValue = boolean | string[];

const DISABLED = new Set(['', 'false', '0', 'off', 'none', 'no', 'undefined', 'null']);
const ENABLED = new Set(['true', 'on', 'yes', '*', 'all']);

/**
 * Parse `TRUST_PROXY`: `false` (default), `true`, or a comma-separated list of IPs/CIDRs.
 * The literal strings `undefined`/`null` count as unset: `process.env.X = undefined` stores the
 * *string* "undefined", and that must never turn into a proxy address called "undefined".
 * A bare digit is refused — a hop count silently trusts the wrong hop as soon as the topology
 * changes, so an explicit address is the only supported way to name a proxy.
 */
export function trustProxySetting(): TrustProxyValue {
  const raw = (process.env.TRUST_PROXY ?? '').trim().toLowerCase();
  if (DISABLED.has(raw)) return false;
  if (ENABLED.has(raw)) return true;
  const entries = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return entries.length ? entries : false;
}

/** A configuration mistake in `TRUST_PROXY`, or null when the value is usable. */
export function trustProxyValueError(): string | null {
  const raw = (process.env.TRUST_PROXY ?? '').trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    return (
      `TRUST_PROXY="${raw}" looks like a hop count, which is not supported: name the proxy explicitly ` +
      '(e.g. TRUST_PROXY=127.0.0.1 or the proxy CIDR), or use true when the API is only reachable through the proxy.'
    );
  }
  return null;
}

/** Is any forwarded header honoured at all? */
export function trustProxyIsEnabled(): boolean {
  const value = trustProxySetting();
  if (Array.isArray(value)) return value.length > 0;
  return value === true;
}

/** Human-readable form for the boot log — never includes a secret. */
export function trustProxyDescription(): string {
  const value = trustProxySetting();
  if (value === false) return 'disabled (the socket address is the client)';
  if (value === true) return 'all proxies trusted — only safe when the API is unreachable except through the proxy';
  return `trusted proxies: ${value.join(', ')}`;
}

/** `PUBLIC_ORIGIN` as a clean origin (`https://host[:port]`), or null when unset/invalid. */
export function publicOrigin(): string | null {
  const raw = process.env.PUBLIC_ORIGIN?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/** Normalise a Host/`x-forwarded-host` value to a bare hostname (lowercase, no port, no brackets). */
export function normalizeHost(value: string | undefined | null): string | null {
  if (!value) return null;
  const first = value.split(',')[0]!.trim().toLowerCase();
  if (!first) return null;
  // [::1]:3001 → ::1 ; example.com:8443 → example.com ; example.com → example.com
  if (first.startsWith('[')) {
    const end = first.indexOf(']');
    return end > 0 ? first.slice(1, end) : null;
  }
  const colon = first.lastIndexOf(':');
  const host = colon > 0 && first.indexOf(':') === colon ? first.slice(0, colon) : first;
  return host || null;
}

function hostFromOrigin(origin: string): string | null {
  try {
    return normalizeHost(new URL(origin).host);
  } catch {
    return null;
  }
}

/**
 * Hostnames the app may redirect to: `PUBLIC_ORIGIN`, the explicit `ALLOWED_HOSTS` list and the
 * origins in `CORS_ORIGIN`. Deliberately **not** the development default of `CORS_ORIGIN`, so a
 * production deployment without any of these three refuses to guess (R3).
 */
export function allowedHosts(): string[] {
  const hosts = new Set<string>();
  const publicHost = publicOrigin();
  if (publicHost) hosts.add(publicHost);
  for (const key of ['ALLOWED_HOSTS', 'CORS_ORIGIN']) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    for (const entry of raw.split(',')) {
      const host = hostFromOrigin(entry.trim()) ?? normalizeHost(entry);
      if (host) hosts.add(host);
    }
  }
  return [...hosts];
}

export type RedirectTarget = {
  /** Origin to redirect to, e.g. `https://ilmnet.example` — never taken from an untrusted host. */
  origin: string;
  /** The host the request claimed, when that host was not on the allowlist. */
  replacedHost: string | null;
};

/**
 * Pick the origin an HTTP→HTTPS redirect may point at.
 *   1. `PUBLIC_ORIGIN` — canonical, the request cannot influence it;
 *   2. otherwise the incoming host, but **only** when it is on the allowlist;
 *   3. otherwise the first allowlisted host (the request host is reported as replaced);
 *   4. no allowlist at all → `null`: the caller must not redirect (the proxy should).
 */
export function redirectTargetFor(incomingHost: string | undefined | null): RedirectTarget | null {
  const canonical = publicOrigin();
  if (canonical) return { origin: canonical, replacedHost: null };

  const hosts = allowedHosts();
  if (!hosts.length) return null;

  const incoming = normalizeHost(incomingHost);
  if (incoming && hosts.includes(incoming)) return { origin: `https://${incoming}`, replacedHost: null };
  return { origin: `https://${hosts[0]}`, replacedHost: incoming && incoming !== hosts[0] ? incoming : null };
}

/**
 * Boot guard (R4). Called from `buildApp()`; only production is affected, because `FORCE_HTTPS`
 * itself is production-only.
 */
export function assertProxyConfiguration(): void {
  // A malformed value is a mistake in every mode.
  const problem = trustProxyValueError();
  if (problem) throw new Error(problem);

  if (!isProduction()) return;
  if (process.env.FORCE_HTTPS?.trim().toLowerCase() !== 'true') return;
  if (trustProxyIsEnabled()) {
    if (!publicOrigin() && !allowedHosts().length) {
      throw new Error(
        'FORCE_HTTPS=true needs a redirect target: set PUBLIC_ORIGIN (e.g. https://ilmnet.example) ' +
          'or list the public host in CORS_ORIGIN / ALLOWED_HOSTS. Without one, ilmNet would have to ' +
          'take the host from the request, which any client can forge.',
      );
    }
    return;
  }
  throw new Error(
    'FORCE_HTTPS=true requires TRUST_PROXY: the API can only see HTTPS when a trusted proxy forwards ' +
      'x-forwarded-proto. With TRUST_PROXY disabled it always sees http and would redirect every ' +
      'request to itself in a loop. Set TRUST_PROXY to the proxy address/CIDR (or true when the API is ' +
      'only reachable through the proxy), or leave the HTTP→HTTPS redirect to the proxy.',
  );
}

/** Request header to read the client host from — only honoured when a proxy is trusted (R2). */
export function forwardedHost(req: { headers: Record<string, unknown>; protocol: string }): string | null {
  if (!trustProxyIsEnabled()) return null;
  const value = req.headers['x-forwarded-host'];
  return typeof value === 'string' && value.trim() ? value : null;
}
