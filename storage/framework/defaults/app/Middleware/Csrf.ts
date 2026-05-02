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

const CSRF_COOKIE_NAME = 'X-CSRF-Token'
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

export default new Middleware({
  name: 'csrf',
  // Run early — before auth, so we don't waste auth work on a request
  // we're going to reject anyway. After maintenance/throttle though.
  priority: 2,

  async handle(request) {
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
    if ((request as any)._skipCsrf === true) return

    // Look up the submitted token. Header is the SPA path; body field
    // is the traditional form-post path. We accept either.
    const headerToken = request.headers.get(CSRF_HEADER_NAME)
      || request.headers.get('X-CSRF-Token')
      || request.headers.get('X-Csrf-Token')
    const body = (request as any).jsonBody || (request as any).formBody || {}
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
  },
})
