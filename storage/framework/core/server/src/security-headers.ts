/**
 * Security response headers for the VIEWS server (stacksjs/stacks#2325).
 *
 * `applySecurityHeaders` in `@stacksjs/router` stamps these onto responses
 * bun-router produces, so `/api/**` carried them and every server-rendered
 * page carried none. The exposure was the wrong way round: the API is not
 * what a browser renders or a person clicks, and the sign-in page is.
 *
 * It cannot be fixed from userland either. `X-Frame-Options` is an HTTP
 * header with no `<meta>` equivalent, and CSP `frame-ancestors` is
 * explicitly ignored when set through `<meta http-equiv>`, so a template
 * has no way to ask for this.
 *
 * ## Why this is a separate function and not the router's
 *
 * The router's version also emits two headers that must NOT follow a page:
 *
 * - **`Content-Security-Policy`** (from `STACKS_CSP`). The router module's
 *   own docstring explains that a blanket policy "breaks inline STX
 *   `<script>`/signal bootstrapping, Stripe iframes, and OAuth popups",
 *   which is exactly why it is opt-in. Today that variable only ever
 *   reaches JSON API responses. Emitting it here would put a policy an app
 *   tested against JSON onto every rendered page, and break the app on
 *   upgrade. A page CSP is worth having, but it is its own decision with
 *   its own testing, not a side effect of this fix.
 *
 * - **`Strict-Transport-Security`**. `startProductionServer` sets
 *   `APP_ENV = process.env.APP_ENV || 'production'`, so `buddy serve` run on
 *   a laptop looks like production from in here. HSTS on `http://localhost`
 *   commits the browser to HTTPS-only for that host for a year, which is
 *   precisely what the router's docstring says it avoids. We cannot tell a
 *   real deployment from a local `buddy serve`, so we do not guess.
 *
 * What is left is the three headers the report asked for, all of which are
 * safe on an HTML response.
 */

import process from 'node:process'

/** Paths another origin is allowed to frame. */
export interface EmbeddableRules {
  /** Exact paths. */
  paths: string[]
  /** Path prefixes, stored with a trailing slash. */
  prefixes: string[]
}

let _isDisabledCache: boolean | undefined

/**
 * The same escape hatch the router honours, so an app behind a proxy that
 * injects its own headers can turn both off with one variable rather than
 * discovering they are configured in two places.
 */
function isDisabled(): boolean {
  if (_isDisabledCache !== undefined)
    return _isDisabledCache
  _isDisabledCache = process.env.STACKS_SECURITY_HEADERS_DISABLE === 'true'
  return _isDisabledCache
}

/**
 * Normalise `config.server.security.embeddable` into the rules the
 * per-response check reads.
 *
 * Resolved once at boot, mirroring `resolveApiProxyRules`: `@stacksjs/config`
 * populates overrides asynchronously, so a per-request read would answer
 * differently depending on how far boot had progressed.
 *
 * An entry ending in `/` is a prefix; anything else is an exact path.
 */
export function resolveEmbeddableRules(input?: readonly string[]): EmbeddableRules {
  const paths: string[] = []
  const prefixes: string[] = []

  for (const raw of input ?? []) {
    const entry = String(raw).trim()
    if (!entry || !entry.startsWith('/'))
      continue

    if (entry.endsWith('/') && entry.length > 1) {
      if (!prefixes.includes(entry))
        prefixes.push(entry)
      continue
    }

    if (!paths.includes(entry))
      paths.push(entry)
  }

  return { paths, prefixes }
}

/** `/embed/` as a prefix matches `/embed` and `/embed/anything`. */
function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname.startsWith(prefix) || pathname === prefix.slice(0, -1)
}

/** Whether this path is one the app said another origin may frame. */
export function isEmbeddablePath(pathname: string, rules: EmbeddableRules): boolean {
  if (rules.paths.includes(pathname))
    return true

  return rules.prefixes.some(prefix => matchesPrefix(pathname, prefix))
}

/**
 * Stamp the view security headers onto a response.
 *
 * Mutates `response.headers` in place and returns `undefined`, so a caller
 * that has nothing else to change can leave the original response alone.
 * A response with immutable headers (a `Response.redirect()`, for instance)
 * cannot be mutated, so it is rebuilt and returned - the same shape
 * `stacks-router.ts` already uses for this case.
 *
 * Never overwrites a header that is already set: an app that set its own
 * `X-Frame-Options` in a template or a proxy has said something more
 * specific.
 */
export function applyViewSecurityHeaders(
  req: Request,
  response: Response,
  rules: EmbeddableRules,
): Response | undefined {
  if (isDisabled())
    return undefined

  const embeddable = isEmbeddablePath(new URL(req.url).pathname, rules)

  const wanted: Array<[string, string]> = [
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ]

  // The only header that actually blocks embedding, so it is the only one an
  // embeddable route opts out of. An app that needs a narrower rule than
  // "same origin only" wants CSP `frame-ancestors`, which it can set itself
  // now that nothing overwrites it.
  if (!embeddable)
    wanted.push(['X-Frame-Options', 'SAMEORIGIN'])

  const missing = wanted.filter(([name]) => !response.headers.has(name))
  if (missing.length === 0)
    return undefined

  try {
    for (const [name, value] of missing)
      response.headers.set(name, value)

    return undefined
  }
  catch {
    // Immutable headers (`Response.redirect()`, some cached responses).
    const headers = new Headers(response.headers)
    for (const [name, value] of missing)
      headers.set(name, value)

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  }
}

/** Test helper - reset the cached env-derived flag. */
export function __resetViewSecurityHeadersCache(): void {
  _isDisabledCache = undefined
}
