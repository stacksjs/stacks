/**
 * Default security response headers (stacksjs/stacks#601).
 *
 * Browsers respect these on every response, so the router applies them
 * globally rather than expecting userland to remember a middleware. The
 * production-only headers (HSTS) check `APP_ENV` first, then `NODE_ENV`,
 * so they never fire over local `http://localhost` where browsers would
 * happily commit the host to HTTPS-only for a year.
 *
 * To customize, set the same header in your own middleware — `headers.set`
 * here uses the standard Headers API, so a later `.set()` wins.
 *
 * Apps that need to opt out entirely can set
 * `STACKS_SECURITY_HEADERS_DISABLE=true` in the environment; that's the
 * safety hatch for embedding Stacks behind a reverse proxy that already
 * injects its own security headers.
 *
 * Content-Security-Policy is intentionally NOT set by default — a blanket
 * policy breaks inline STX `<script>`/signal bootstrapping, Stripe iframes,
 * and OAuth popups, so it can't be a safe framework default. Apps that want
 * one set `STACKS_CSP=<policy>` (or `STACKS_CSP_REPORT_ONLY=<policy>` to
 * observe violations first) and the value is emitted verbatim.
 */

import process from 'node:process'

let _isProductionCache: boolean | undefined
let _isDisabledCache: boolean | undefined
let _cspCache: { header: string, value: string } | null | undefined
let _headerTemplateCache: Headers | undefined

function isProduction(): boolean {
  if (_isProductionCache !== undefined)
    return _isProductionCache
  const env = (process.env.APP_ENV ?? process.env.NODE_ENV ?? '').toLowerCase()
  _isProductionCache = env === 'production'
  return _isProductionCache
}

// Boot-time env var, never changes at runtime — cache it like isProduction()
// so the per-response path doesn't touch process.env on every request.
function isDisabled(): boolean {
  if (_isDisabledCache !== undefined)
    return _isDisabledCache
  _isDisabledCache = process.env.STACKS_SECURITY_HEADERS_DISABLE === 'true'
  return _isDisabledCache
}

// Resolve the opt-in CSP once. Enforcing policy wins over report-only when
// both are set. Returns null when neither env var is configured.
function resolveCsp(): { header: string, value: string } | null {
  if (_cspCache !== undefined)
    return _cspCache
  const enforce = process.env.STACKS_CSP
  const report = process.env.STACKS_CSP_REPORT_ONLY
  if (enforce)
    _cspCache = { header: 'Content-Security-Policy', value: enforce }
  else if (report)
    _cspCache = { header: 'Content-Security-Policy-Report-Only', value: report }
  else
    _cspCache = null
  return _cspCache
}

/**
 * Apply the default security headers to a Headers instance in-place.
 *
 * Headers applied unconditionally (cheap, no compat risk):
 * - `X-Content-Type-Options: nosniff` — blocks MIME-sniff XSS
 * - `X-Frame-Options: SAMEORIGIN` — clickjacking protection (CSP
 *   `frame-ancestors` is the modern equivalent but XFO still ships)
 * - `Referrer-Policy: strict-origin-when-cross-origin` — modern default
 *
 * Production-only:
 * - `Strict-Transport-Security: max-age=31536000; includeSubDomains` —
 *   tells browsers to commit to HTTPS for a year. Omits `preload` since
 *   that's an irreversible commitment to the browser preload list.
 *
 * Skips overwriting any header that's already set — explicit userland
 * config wins. Skips entirely when `STACKS_SECURITY_HEADERS_DISABLE=true`.
 * `knownMissing` is reserved for router-created responses whose security
 * headers are known to be absent, avoiding redundant native lookups.
 */
export function applySecurityHeaders(headers: Headers, knownMissing = false): void {
  if (isDisabled())
    return

  if (knownMissing || headers.get('X-Content-Type-Options') === null)
    headers.set('X-Content-Type-Options', 'nosniff')

  if (knownMissing || headers.get('X-Frame-Options') === null)
    headers.set('X-Frame-Options', 'SAMEORIGIN')

  if (knownMissing || headers.get('Referrer-Policy') === null)
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  if (isProduction() && (knownMissing || headers.get('Strict-Transport-Security') === null))
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

  const csp = resolveCsp()
  if (csp && (knownMissing || headers.get(csp.header) === null))
    headers.set(csp.header, csp.value)
}

/** Add the defaults to a fresh response-init record before Response creation. */
export function applySecurityHeadersToRecord(headers: Record<string, string>): void {
  if (isDisabled())
    return

  headers['X-Content-Type-Options'] = 'nosniff'
  headers['X-Frame-Options'] = 'SAMEORIGIN'
  headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'

  if (isProduction())
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'

  const csp = resolveCsp()
  if (csp)
    headers[csp.header] = csp.value
}

/** Clone the resolved defaults without rebuilding their JS record each time. */
export function createSecurityHeaders(): Headers {
  if (!_headerTemplateCache) {
    _headerTemplateCache = new Headers()
    applySecurityHeaders(_headerTemplateCache, true)
  }
  return new Headers(_headerTemplateCache)
}

/** Test helper — reset the cached env-derived flags. */
export function __resetSecurityHeadersCache(): void {
  _isProductionCache = undefined
  _isDisabledCache = undefined
  _cspCache = undefined
  _headerTemplateCache = undefined
}
