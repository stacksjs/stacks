import { randomBytes, timingSafeEqual } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { HttpError } from '@stacksjs/error-handling'
import { Middleware } from '@stacksjs/router'

/**
 * CSRF Protection Middleware (default-on for unsafe methods)
 *
 * Design decision: enforce by default.
 *  Historical Stacks ran the CSRF middleware as opt-in, which left every
 *  POST/PUT/PATCH/DELETE route undefended unless an author remembered to
 *  add `.middleware('csrf')`. Forgetting is a security regression by
 *  default — flipping the polarity (default-on, explicit opt-out) is the
 *  modern Rails/Laravel posture.
 *
 * Pattern: stateless double-submit cookie.
 *   1. Server issues a 32-byte random token in a non-HttpOnly cookie
 *      (`X-CSRF-Token`) on safe (GET/HEAD/OPTIONS) responses.
 *   2. Client-side JS reads that cookie and echoes it back on unsafe
 *      requests via the `X-CSRF-Token` header (or a `_token` body field
 *      for traditional form submissions).
 *   3. Server compares header/body value to cookie value with a
 *      timing-safe equality check.
 *
 * Why double-submit (and not server-stored tokens):
 *   - Stateless. No session/cache lookup on the hot path — just a
 *     constant-time string compare.
 *   - Same origin policy means a cross-site attacker can't read the
 *     cookie value, so they can't forge the matching header.
 *   - Cookie is `SameSite=Lax`, so most cross-site contexts won't even
 *     ship it; the double-submit check is a belt-and-braces layer for
 *     the gaps SameSite leaves (e.g. top-level GET → POST chains via
 *     forms).
 *
 * Bypass (in priority order):
 *   1. Safe methods (GET/HEAD/OPTIONS) — no body to forge, no check.
 *   2. `Authorization: Bearer …` present — API token clients are
 *      immune by definition (a CSRF attacker can't read tokens from
 *      Authorization headers, only forge cookie-auth requests).
 *   3. Per-action `skipCsrf: true` — webhooks/callbacks that legitimately
 *      can't carry a CSRF cookie. The action sets this on its default
 *      export and the router's CSRF check skips it.
 *   4. Per-route `.skipCsrf()` — same intent, route-level.
 *
 * @example
 * ```ts
 * // Implicit — every POST is CSRF-checked
 * route.post('/posts', 'Actions/CreatePost')
 *
 * // Explicit opt-out for a webhook
 * route.post('/webhooks/stripe', 'Actions/StripeWebhook').skipCsrf()
 *
 * // Or via the action itself
 * export default {
 *   skipCsrf: true,
 *   async handle(req) { … },
 * }
 * ```
 */

export const CSRF_COOKIE_NAME = 'X-CSRF-Token'
const CSRF_HEADER_NAME = 'x-csrf-token'
const TOKEN_BYTES = 32

/**
 * Generate a fresh CSRF token (hex-encoded, 32 random bytes → 64 chars).
 *
 * @example
 * ```ts
 * const token = generateCsrfToken()
 * // → 'a3f1...cd9e'
 * ```
 */
export function generateCsrfToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex')
}

/**
 * Seed the CSRF cookie on the outgoing response if the incoming request
 * didn't already carry one, or with the token the router minted before
 * rendering (`minted`) so a server-rendered page's forms and the browser's
 * cookie hold the same string. Used by the router as a post-response step
 * on safe-method (GET/HEAD/OPTIONS) responses so SPAs get a usable
 * cookie value before they ever submit an unsafe request.
 *
 * The audit (stacksjs/stacks#1859 INVESTIGATE → confirmed) found that
 * the CSRF middleware was reading the cookie but nothing was ever
 * writing it — every browser POST without a Bearer token therefore
 * failed CSRF by default. This helper closes that gap.
 *
 * The cookie is:
 * - `SameSite=Lax` (sufficient for cross-site CSRF mitigation while
 *   still allowing top-level navigation to set it)
 * - **NOT** `HttpOnly` (SPA JS needs to read the value and echo it as
 *   a header — the whole point of the double-submit pattern)
 * - `Secure` only over HTTPS (so localhost dev still works)
 * - 2-hour `Max-Age` — short enough to limit replay if leaked, long
 *   enough that idle tabs don't constantly re-fetch tokens
 */
/**
 * Whether a response is already handing the browser a CSRF token.
 *
 * `getSetCookie` is the only way to read multiple `Set-Cookie` headers back;
 * `get` joins them into one string, which is not something a cookie value can
 * be parsed out of reliably. Older runtimes without it fall back to the joined
 * form, where a substring match is still correct for the question being asked.
 */
function responseAlreadySeeds(response: Response): boolean {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const cookies = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [headers.get('set-cookie') || '']

  return cookies.some(cookie =>
    cookie.startsWith(`${CSRF_COOKIE_NAME}=`)
    || cookie.startsWith('csrf-token=')
    || cookie.includes(`, ${CSRF_COOKIE_NAME}=`)
    || cookie.includes(', csrf-token='),
  )
}

export function seedCsrfCookieIfMissing(req: Request, response: Response, minted?: string): Response {
  const cookieHeader = req.headers.get('cookie') || ''

  // A token the router minted before rendering wins over "the header already
  // has one", because it put that value in the header itself - and the page
  // has already embedded it in every form it drew. Generating a second token
  // here would store one string in the browser while the page carries another,
  // which fails in a way indistinguishable from having no token at all.
  if (!minted && (cookieHeader.includes(`${CSRF_COOKIE_NAME}=`) || cookieHeader.includes('csrf-token='))) {
    return response
  }

  // A token already on its way to the browser counts as present, exactly like
  // one in the request. Something upstream can mint before the render - the
  // stx dev server does, so a page's forms carry a token on a first visit -
  // and appending a second here would leave the browser storing the last
  // Set-Cookie while the page embedded the first. Two tokens fail the same way
  // no token does, and are far harder to see.
  if (responseAlreadySeeds(response))
    return response

  const token = minted || generateCsrfToken()
  const isSecure = req.url.startsWith('https://')
  const cookie = [
    `${CSRF_COOKIE_NAME}=${token}`,
    'Path=/',
    'SameSite=Lax',
    'Max-Age=7200',
    isSecure ? 'Secure' : null,
  ].filter(Boolean).join('; ')

  // Append (not Set) so multiple Set-Cookie headers can coexist with any
  // cookies the action handler set itself.
  try {
    response.headers.append('Set-Cookie', cookie)
    return response
  }
  catch {
    // Response headers can be immutable (e.g., when the response was
    // built from a static asset). Clone with a fresh Headers object
    // to attach the cookie.
    const headers = new Headers(response.headers)
    headers.append('Set-Cookie', cookie)
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  }
}

/**
 * Parse the Cookie header into a key→value map.
 * Lenient: malformed pairs are skipped, not thrown.
 */
function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.get('cookie')
  if (!header) return {}
  const out: Record<string, string> = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k) out[k] = v
  }
  return out
}

/**
 * Constant-time string compare. `===` leaks token length & match-prefix
 * length via timing — `timingSafeEqual` does not.
 */
function safeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b))
  }
  catch {
    return false
  }
}

/**
 * Returns true when the request carries a `Authorization: Bearer …`
 * credential — those clients are exempt from CSRF (they're not riding
 * an ambient cookie credential, so cross-site forgery doesn't apply).
 */
function hasBearerToken(req: Request): boolean {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization')
  return typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Validate one request with the framework's native CSRF contract.
 *
 * Exported so direct framework-owned handlers that intentionally sit outside
 * the router, such as the local dashboard config editor, can enforce the same
 * double-submit and bearer-token rules without duplicating security logic.
 */
export async function validateCsrfRequest(request: Request): Promise<void> {
  const method = request.method.toUpperCase()

  // Safe methods don't mutate state — no token check needed.
  // Token *seeding* (set the cookie if it's missing) happens after
  // the response is built; we don't have a post-response hook
  // here, so action handlers / SPAs can call `generateCsrfToken()`
  // themselves on the first GET they need it for.
  if (SAFE_METHODS.has(method)) return

  // API clients with a bearer token are exempt — see header docstring.
  if (hasBearerToken(request)) return

  // Per-action opt-out: an action exporting `skipCsrf: true` (or
  // `csrf: false`) has declared it can't participate in CSRF
  // (webhooks, third-party callbacks). The router stamps a hint on
  // the request when it resolves such an action; if that hint is
  // present, skip enforcement.
  if (request._skipCsrf === true) return

  // Look up the submitted token. Header is the SPA path; body field
  // is the traditional form-post path. We accept either.
  const headerToken = request.headers.get(CSRF_HEADER_NAME)
    || request.headers.get('X-CSRF-Token')
    || request.headers.get('X-Csrf-Token')
  const body = request.jsonBody || request.formBody || {}
  const bodyToken: string | undefined = body?._token ?? body?.csrf_token

  const submitted = (typeof headerToken === 'string' && headerToken)
    || (typeof bodyToken === 'string' && bodyToken)
    || ''

  const cookies = parseCookies(request)
  const cookieToken = cookies[CSRF_COOKIE_NAME] || cookies['csrf-token'] || ''

  if (!submitted || !cookieToken || !safeEqual(submitted, cookieToken)) {
    // 419 is the convention Laravel popularized for "CSRF token
    // mismatch" — it's not in the IANA list but most SPAs already
    // know how to refresh on 419. We use 403 for the strict-correct
    // status code instead (419 is non-standard).
    throw new HttpError(403, 'CSRF token mismatch')
  }
}

export default new Middleware({
  name: 'csrf',
  // Run early — before auth, so we don't waste auth work on a request
  // we're going to reject anyway. After maintenance/throttle though.
  priority: 2,

  async handle(request) {
    await validateCsrfRequest(request)
  },
})
