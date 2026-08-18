/**
 * Declarative URL redirects for the views server, shared by the dev views
 * server (core/actions/src/dev/views.ts) and the production server
 * (`buddy serve`) so a rule behaves the same in both.
 *
 * ## Why this exists
 *
 * Every site that replaces an older one inherits its URLs. Those URLs are in
 * search indexes, in other people's links, and on printed material, and the
 * only thing that carries their standing across to the new page is a 301. Up
 * to now a Stacks app had nowhere to say so: `config/server.ts` could forward
 * a path to the API, and a page could redirect from `definePageMeta`, but that
 * second one needs a real page to exist at the old URL, which means committing
 * a stub `.stx` file per legacy path purely to throw the request away again.
 *
 * So the app declares them, the way `proxy` is declared, and the views server
 * answers before it looks for a page.
 *
 * ## Where this runs
 *
 * In the `onRequest` hook, which stx runs BEFORE static file serving. A rule
 * therefore shadows a `public/` file of the same name — the same caveat that
 * applies to `proxy.paths`. Redirecting `/logo.png` makes `public/logo.png`
 * unreachable.
 *
 * `/api/**` is never redirected. An API path reaching here at all means the
 * proxy rules did not claim it, and bouncing a JSON client to an HTML page is
 * never the intent behind a redirect written for a browser.
 */

/** The prefix redirects refuse to touch, whatever the app declares. */
const PROTECTED_PREFIX = '/api/'

/** Permanent unless the app says otherwise: these describe moved pages. */
export const DEFAULT_REDIRECT_STATUS = 301

/** What an app writes in `config/server.ts` under `redirects`. */
export type RedirectConfig = Record<string, string | RedirectTarget>

export interface RedirectTarget {
  /** Where to send the request. A path, or an absolute URL to leave the site. */
  to: string
  /**
   * The status to answer with. Defaults to {@link DEFAULT_REDIRECT_STATUS}.
   *
   * Use 302 for something genuinely temporary. A 301 is cached hard by
   * browsers and is difficult to take back, which is exactly what you want for
   * a permanent move and exactly what you do not want for a seasonal one.
   */
  status?: number
  /**
   * Whether to carry the incoming query string onto the target.
   *
   * Defaults to true, because a redirect that silently drops `?utm_source=…`
   * loses the attribution for the visit it just forwarded. Set false when the
   * target's own query string is the point.
   */
  preserveQuery?: boolean
}

export interface RedirectRule {
  /** The incoming path, normalised: leading slash, no trailing slash. */
  from: string
  to: string
  status: number
  preserveQuery: boolean
  /**
   * True when the rule was written as `/section/*` and therefore claims the
   * whole subtree, appending whatever followed the prefix to `to`.
   */
  subtree: boolean
}

export type RedirectRules = Map<string, RedirectRule>

/**
 * A trailing slash is almost never meant to be significant in a redirect
 * table, so `/our-story/` and `/our-story` are stored and matched as one.
 * The root stays `/`.
 */
function normalizePath(value: string): string {
  const path = String(value).trim()
  if (!path.startsWith('/'))
    return ''

  return path.length > 1 && path.endsWith('/') ? path.replace(/\/+$/, '') : path
}

/**
 * Normalise app configuration into the map the resolver reads.
 *
 * Resolved once at boot rather than per request: `@stacksjs/config` fills in
 * overrides asynchronously, so a per-request read would answer differently
 * depending on how far boot had got.
 *
 * Invalid entries are dropped rather than thrown on. A malformed redirect
 * should not stop a site from booting, and the one that matters — a rule that
 * points at itself, which would loop the browser until it gives up — is caught
 * here rather than in production.
 */
export function resolveRedirectRules(input: RedirectConfig = {}): RedirectRules {
  const rules: RedirectRules = new Map()

  for (const [rawFrom, rawTarget] of Object.entries(input ?? {})) {
    // `/section/*` claims the subtree. Stored under the prefix WITHOUT the
    // star so lookups stay a plain map read.
    const subtree = rawFrom.endsWith('/*')
    const from = normalizePath(subtree ? rawFrom.slice(0, -2) || '/' : rawFrom)
    if (!from)
      continue

    // Never shadow the API. See the note at the top of this file.
    if (from === PROTECTED_PREFIX.slice(0, -1) || from.startsWith(PROTECTED_PREFIX))
      continue

    const target = typeof rawTarget === 'string' ? { to: rawTarget } : rawTarget
    const to = String(target?.to ?? '').trim()
    if (!to)
      continue

    // A rule that redirects a path to itself is a loop, and the browser is the
    // one that finds out. Absolute targets are left alone: an off-site URL
    // that happens to end in the same path is not a loop.
    if (!/^https?:\/\//i.test(to) && normalizePath(to) === from)
      continue

    rules.set(subtree ? `${from}/*` : from, {
      from,
      to,
      status: Number(target?.status) || DEFAULT_REDIRECT_STATUS,
      preserveQuery: target?.preserveQuery !== false,
      subtree,
    })
  }

  return rules
}

/**
 * The response for a redirected path, or undefined to carry on routing.
 *
 * Matching is exact on the normalised path, and an exact rule always wins over
 * a subtree one covering the same URL.
 *
 * ONE wildcard form is supported, `/section/*`, and general pattern rules
 * still are not. The reasoning behind that original restriction stands — a
 * redirect table is read by whoever is debugging a URL at two in the morning,
 * and every wildcard is something they have to simulate in their head — but
 * exact matching cannot express the case that forced this: moving a whole
 * section to another host when some of its pages are dynamic. `/dashboard/*`
 * has to cover `/dashboard/events/42`, and there is no list of exact rules
 * that does.
 *
 * `/section/*` means that subtree and nothing else: whatever followed the
 * prefix is appended to the target, so `/dashboard/events/42` with
 * `'/dashboard/*': 'https://dash.example.com'` lands on
 * `https://dash.example.com/events/42`. No regular expressions, no captures,
 * no ordering to reason about.
 */
export function resolveRedirect(url: URL, rules?: RedirectRules): Response | undefined {
  if (!rules?.size)
    return undefined

  const pathname = normalizePath(url.pathname)
  const rule = rules.get(pathname) ?? matchSubtree(pathname, rules)
  if (!rule)
    return undefined

  let location = rule.to

  // Append the part of the path the prefix did not claim, so a subtree rule
  // lands on the matching page rather than the target's root.
  if (rule.subtree) {
    const remainder = pathname.slice(rule.from.length)
    if (remainder)
      location = location.replace(/\/$/, '') + remainder
  }

  if (rule.preserveQuery && url.search) {
    // Merge rather than overwrite, so a target that carries its own query
    // string keeps it and the incoming one is appended.
    location += location.includes('?') ? `&${url.search.slice(1)}` : url.search
  }

  return new Response(null, {
    status: rule.status,
    headers: {
      'Location': location,
      // A permanent redirect is worth caching; a temporary one is not, and
      // caching it is how a seasonal rule outlives the season.
      'Cache-Control': rule.status === 301 || rule.status === 308
        ? 'public, max-age=3600'
        : 'no-store',
    },
  })
}

/**
 * The subtree rule claiming this path, if any.
 *
 * The LONGEST matching prefix wins, so a more specific section can be carved
 * out of a broader one (`/dashboard/reports/*` beside `/dashboard/*`) without
 * depending on declaration order.
 */
function matchSubtree(pathname: string, rules: RedirectRules): RedirectRule | undefined {
  let best: RedirectRule | undefined

  for (const rule of rules.values()) {
    if (!rule.subtree)
      continue
    // A boundary check, not a string prefix: `/dashboards` must not be claimed
    // by a rule for `/dashboard`.
    if (pathname !== rule.from && !pathname.startsWith(`${rule.from}/`))
      continue
    if (!best || rule.from.length > best.from.length)
      best = rule
  }

  return best
}

/**
 * A one-line summary for the dev server's boot output.
 *
 * Same reasoning as `describeApiProxyRules`: a redirect you did not expect is
 * very hard to diagnose when the rule that caused it is invisible.
 */
export function describeRedirectRules(rules: RedirectRules): string {
  if (!rules.size)
    return 'none'

  const shown = [...rules.values()].slice(0, 3).map(rule => `${rule.from} → ${rule.to}`)
  const rest = rules.size - shown.length

  return rest > 0 ? `${shown.join(', ')} (+${rest} more)` : shown.join(', ')
}
