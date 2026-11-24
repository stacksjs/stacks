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
 *
 * ## Since stacksjs/stacks#3358
 *
 * `resolveViewSecurityRules()` adds what can be sent safely after all:
 * HSTS once `APP_URL` says the app is https on a real host (the laptop case
 * above has a local host, or no https), `Cross-Origin-Opener-Policy:
 * same-origin-allow-popups`, and a `Permissions-Policy` that turns off only
 * features no stx composable uses. Each is configurable in
 * `config.server.security`. The API's `STACKS_CSP` still never reaches a page.
 */

import process from 'node:process'

/** Paths another origin is allowed to frame. */
export interface EmbeddableRules {
  /** Exact paths. */
  paths: string[]
  /** Path prefixes, stored with a trailing slash. */
  prefixes: string[]
}

/**
 * Everything the views server stamps on a page, resolved once at boot.
 *
 * A `null` header is not sent. `resolveEmbeddableRules()` alone still gives
 * the original three headers, so a caller that never resolved these is
 * unchanged.
 */
export interface ViewSecurityRules extends EmbeddableRules {
  hsts?: string | null
  crossOriginOpenerPolicy?: string | null
  permissionsPolicy?: string | null
  /** The page CSP, or null when the app has not turned it on. */
  csp?: ResolvedPageCsp | null
}

/** CSP directives: each a list of sources, or `false` to drop a default one. */
export type CspDirectives = Record<string, readonly string[] | false>

/** `config.server.security.csp`. */
export type PageCspOption = boolean | 'report-only' | {
  /** Send `Content-Security-Policy-Report-Only`, which reports and blocks nothing. */
  reportOnly?: boolean
  /** Merged over the defaults; the nonce is always added to `script-src`. */
  directives?: CspDirectives
  /** Where the browser posts violation reports. */
  reportUri?: string
}

interface ResolvedPageCsp {
  reportOnly: boolean
  directives: CspDirectives
  reportUri?: string
}

/** The page security settings in `config.server.security`. */
export interface ViewSecurityOptions {
  embeddable?: readonly string[]
  hsts?: boolean | string
  crossOriginOpenerPolicy?: string | false
  permissionsPolicy?: Record<string, string> | false
  csp?: PageCspOption
}

const HSTS_DEFAULT = 'max-age=31536000; includeSubDomains'

/**
 * Off only for features no stx composable uses: camera, microphone,
 * geolocation, clipboard, fullscreen, wake lock and the sensors all have
 * one, and Stripe's payment iframe needs `payment`.
 */
const PERMISSIONS_POLICY_DEFAULT: Record<string, string> = {
  'browsing-topics': '()',
  'usb': '()',
  'serial': '()',
  'hid': '()',
  'bluetooth': '()',
  'midi': '()',
}

/**
 * Whether `APP_URL` is an https address on a real host, which is when HSTS is
 * safe to send. Over http a browser ignores HSTS anyway; on a local host it
 * would pin `*.localhost` or a `.test` domain to HTTPS for a year, which is
 * why this path never sent it before.
 */
export function servesHttpsPublicly(appUrl: string | undefined): boolean {
  if (!appUrl) return false
  let url: URL
  try { url = new URL(appUrl.includes('://') ? appUrl : `https://${appUrl}`) }
  catch { return false }
  if (url.protocol !== 'https:') return false
  const host = url.hostname.replace(/^\[|\]$/g, '')
  return !(host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.test') || host === '::1' || /^127\.\d+\.\d+\.\d+$/.test(host))
}

/**
 * The page security rules from `config.server.security` and `APP_URL`
 * (stacksjs/stacks#3358). Resolved once at boot, like the embeddable rules.
 */
export function resolveViewSecurityRules(security: ViewSecurityOptions | undefined, appUrl: string | undefined): ViewSecurityRules {
  const rules: ViewSecurityRules = resolveEmbeddableRules(security?.embeddable)

  const hsts = security?.hsts
  rules.hsts = hsts === false ? null : typeof hsts === 'string' ? hsts : servesHttpsPublicly(appUrl) ? HSTS_DEFAULT : null

  const coop = security?.crossOriginOpenerPolicy
  rules.crossOriginOpenerPolicy = coop === false ? null : coop || 'same-origin-allow-popups'

  const permissions = security?.permissionsPolicy
  rules.permissionsPolicy = permissions === false
    ? null
    : Object.entries({ ...PERMISSIONS_POLICY_DEFAULT, ...permissions }).map(([feature, allow]) => `${feature}=${allow}`).join(', ')

  const csp = security?.csp
  rules.csp = !csp
    ? null
    : csp === true || csp === 'report-only'
      ? { reportOnly: csp === 'report-only', directives: {} }
      : { reportOnly: csp.reportOnly === true, directives: csp.directives ?? {}, reportUri: csp.reportUri }

  return rules
}

/**
 * The page policy's defaults. Scripts must be the page's own or carry this
 * response's nonce; styles may be inline, because stx and ts-css write style
 * attributes, and a nonce in `style-src` would make browsers ignore
 * `'unsafe-inline'` and block them.
 */
const PAGE_CSP_DEFAULTS: Record<string, readonly string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'self'"],
}

/**
 * The CSP header value for one response: the defaults, then the app's
 * directives over them, with `nonce` added to `script-src`. An embeddable
 * path has no `frame-ancestors`, the CSP twin of its missing X-Frame-Options.
 */
export function pageContentSecurityPolicy(directives: CspDirectives, nonce: string, embeddable: boolean, reportUri?: string): string {
  const merged: Record<string, readonly string[] | false> = { ...PAGE_CSP_DEFAULTS, ...directives }
  if (embeddable && !directives['frame-ancestors'])
    merged['frame-ancestors'] = false
  const parts: string[] = []
  for (const [name, sources] of Object.entries(merged)) {
    if (sources === false) continue
    const list = name === 'script-src' ? [...sources, `'nonce-${nonce}'`] : sources
    parts.push(list.length > 0 ? `${name} ${list.join(' ')}` : name)
  }
  if (reportUri)
    parts.push(`report-uri ${reportUri}`)
  return parts.join('; ')
}

/** 16 random bytes, base64: a CSP nonce. */
function newNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64')
}

/**
 * The page with a nonce on every `<script>` and the policy that allows them.
 * Only an HTML response is rewritten, and one that already carries a policy
 * of its own is left as it is.
 */
function withPageCsp(response: Response, csp: ResolvedPageCsp, embeddable: boolean): Response {
  const header = csp.reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy'
  if (!/^text\/html\b/i.test(response.headers.get('Content-Type') ?? '')
    || response.headers.has('Content-Security-Policy') || response.headers.has('Content-Security-Policy-Report-Only'))
    return response

  const nonce = newNonce()
  const rewritten = new HTMLRewriter()
    .on('script', { element(element) { element.setAttribute('nonce', nonce) } })
    .transform(response)
  const headers = new Headers(rewritten.headers)
  headers.set(header, pageContentSecurityPolicy(csp.directives, nonce, embeddable, csp.reportUri))
  // The body changed length; let the server count it again.
  headers.delete('Content-Length')
  return new Response(rewritten.body, { status: response.status, statusText: response.statusText, headers })
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
  rules: EmbeddableRules | ViewSecurityRules,
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

  const view = rules as ViewSecurityRules
  if (view.hsts)
    wanted.push(['Strict-Transport-Security', view.hsts])
  if (view.crossOriginOpenerPolicy)
    wanted.push(['Cross-Origin-Opener-Policy', view.crossOriginOpenerPolicy])
  if (view.permissionsPolicy)
    wanted.push(['Permissions-Policy', view.permissionsPolicy])

  const missing = wanted.filter(([name]) => !response.headers.has(name))
  let secured: Response | undefined
  if (missing.length > 0) {
    try {
      for (const [name, value] of missing)
        response.headers.set(name, value)
    }
    catch {
      // Immutable headers (`Response.redirect()`, some cached responses).
      const headers = new Headers(response.headers)
      for (const [name, value] of missing)
        headers.set(name, value)

      secured = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    }
  }

  if (!view.csp)
    return secured

  const current = secured ?? response
  const withCsp = withPageCsp(current, view.csp, embeddable)
  return withCsp === current ? secured : withCsp
}

/** Test helper - reset the cached env-derived flag. */
export function __resetViewSecurityHeadersCache(): void {
  _isDisabledCache = undefined
}
