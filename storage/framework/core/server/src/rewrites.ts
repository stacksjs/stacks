/**
 * Paths the API process answers under a DIFFERENT path.
 *
 * `proxy.paths` already forwards a root path to the API, but it forwards the
 * path unchanged, which only helps when the API registered that same URL.
 * `routes/api.ts` carries an `/api` prefix, so a handler whose public home is
 * the site root — `/sitemap.xml`, `/rss.xml`, `/.well-known/*` — is registered
 * as `/api/sitemap.xml` and the root path 404s. There is no way to spell that
 * with the existing options: `proxy` cannot change the path, and a redirect
 * sends the client somewhere else instead of answering where it asked.
 *
 * A rewrite is server-side and invisible to the client: the URL in the address
 * bar (and in a crawler's index) stays the one that was requested.
 *
 * Kept separate from `redirects.ts` deliberately. They look alike and are not:
 * a redirect is an answer telling the client to go elsewhere, a rewrite is the
 * server fetching from elsewhere and answering as itself.
 */

/** Anything under this belongs to the API already and is never rewritten. */
const PROTECTED_PREFIX = '/api/'

export interface RewriteRule {
  /** The incoming path, normalised: leading slash, no trailing slash. */
  from: string
  /** The path to ask the API for instead. */
  to: string
  /**
   * True when written as `/prefix*`, claiming every path starting with it and
   * appending the remainder to `to`.
   *
   * Needed for the chunked case — `/sitemap-trails-1.xml` through
   * `-24.xml` are one rule, not twenty-four, and the count changes with the
   * size of the table behind them.
   */
  prefix: boolean
}

export type RewriteRules = Map<string, RewriteRule>

export type RewriteConfig = Record<string, string>

function normalizePath(value: string): string {
  const path = String(value).trim()
  if (!path.startsWith('/'))
    return ''

  return path.length > 1 && path.endsWith('/') ? path.replace(/\/+$/, '') : path
}

/**
 * Normalise app configuration into the map the resolver reads.
 *
 * Resolved once at boot, for the same reason the redirect table is: config
 * overrides arrive asynchronously, so a per-request read answers differently
 * depending on how far boot has got.
 *
 * Invalid entries are dropped rather than thrown on — a malformed rewrite must
 * not stop a site booting — and so is a rule that rewrites a path to itself,
 * which would otherwise proxy the views server to the API and back.
 */
export function resolveRewriteRules(input: RewriteConfig = {}): RewriteRules {
  const rules: RewriteRules = new Map()

  for (const [rawFrom, rawTo] of Object.entries(input ?? {})) {
    const prefix = rawFrom.endsWith('*')
    const from = normalizePath(prefix ? rawFrom.slice(0, -1) : rawFrom)
    if (!from)
      continue

    // A rewrite FROM an /api path is meaningless: it is already there.
    if (from === PROTECTED_PREFIX.slice(0, -1) || from.startsWith(PROTECTED_PREFIX))
      continue

    const to = normalizePath(prefix && rawTo.endsWith('*') ? rawTo.slice(0, -1) : rawTo)
    if (!to || to === from)
      continue

    rules.set(from, { from, to, prefix })
  }

  return rules
}

/**
 * The path to ask the API for, or undefined when nothing matches.
 *
 * An exact rule always wins over a prefix one, and the longest prefix wins
 * among those — so a specific path can be carved out of a subtree that is
 * otherwise rewritten wholesale.
 */
export function resolveRewrite(pathname: string, rules?: RewriteRules): string | undefined {
  if (!rules || rules.size === 0)
    return undefined

  const path = normalizePath(pathname)
  if (!path)
    return undefined

  const exact = rules.get(path)
  if (exact && !exact.prefix)
    return exact.to

  let best: RewriteRule | undefined
  for (const rule of rules.values()) {
    if (!rule.prefix || !path.startsWith(rule.from))
      continue
    if (!best || rule.from.length > best.from.length)
      best = rule
  }

  if (!best)
    return undefined

  return `${best.to}${path.slice(best.from.length)}`
}

/** A one-line summary for the dev server's boot output. */
export function describeRewriteRules(rules: RewriteRules): string {
  if (!rules || rules.size === 0)
    return ''

  return [...rules.values()]
    .map(rule => `${rule.from}${rule.prefix ? '*' : ''} → ${rule.to}${rule.prefix ? '*' : ''}`)
    .join(', ')
}
