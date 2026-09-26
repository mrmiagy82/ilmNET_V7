/**
 * Environment banner for the browser specs (environment rule, docs/ENVIRONMENTS.md).
 *
 * A browser run must say which deployment it targets and which environment that deployment reports,
 * so a green result can never be mistaken for evidence about another environment. The banner asks the
 * API itself (`/api/health`) — it does not assume the target from a URL or an environment variable,
 * and it prints no credentials (the admin token is never echoed).
 *
 * Staging is called out explicitly: crawling is disabled there by design, so a "no index" finding on
 * a staging run is the expected posture and not a defect.
 */
export async function announceTargetEnvironment(suite, { site, api } = {}) {
  const SITE = site || process.env.SITE_URL || 'http://localhost:3101';
  const API = api || process.env.API_URL || SITE;
  let reported = 'unknown (the API did not answer /api/health)';
  let release = '';
  try {
    const res = await fetch(`${API}/api/health`);
    const body = await res.json().catch(() => ({}));
    if (res.ok || res.status === 503) {
      reported = body.environment ? `${body.environment} (source: ${body.environmentSource ?? 'unknown'})` : `not reported (env=${body.env ?? 'unknown'})`;
      release = ` · release ${body.version ?? '?'}${body.commit ? ` (${String(body.commit).slice(0, 7)})` : ''}`;
    } else {
      reported = `unexpected HTTP ${res.status} from /api/health`;
    }
  } catch (e) {
    reported = `unreachable (${e?.message ?? e})`;
  }
  console.log('===============================================================');
  console.log(`Suite    : ${suite}`);
  console.log(`Site     : ${SITE}`);
  console.log(`API      : ${API}`);
  console.log(`Environment reported by the deployment: ${reported}${release}`);
  if (String(reported).startsWith('staging')) {
    console.log('Note     : staging — crawling is disabled on purpose (robots.txt, x-robots-tag).');
  }
  console.log('===============================================================\n');
  return reported;
}
