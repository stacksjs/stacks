import { config } from '@stacksjs/config'
import { Auth } from './authentication'

/** Whatever the token layer resolves a user to, so the two cannot drift. */
type AuthenticatedUser = Awaited<ReturnType<typeof Auth.getUserFromToken>>

/**
 * Cookie-carried access tokens, for server-rendered pages.
 *
 * The token system assumes an API client that can hold a bearer token and put
 * it in a header. A server-rendered page has no such client: the browser posts
 * a form, follows a redirect, and comes back with nothing but cookies. So
 * those apps ended up either inventing their own cookie format or reaching for
 * `SessionAuth`, whose in-memory map drops every session when the process
 * restarts and cannot be shared across workers.
 *
 * This carries the same personal access token the API uses in an httpOnly
 * cookie: one source of truth for who is signed in, revocable through the
 * usual token calls, and durable because the token lives in the database.
 *
 * The cookie is httpOnly (a page script never needs it), SameSite=Lax (so a
 * link from an email still arrives signed in, while a cross-site POST does
 * not), and Secure everywhere except local HTTP development.
 */

export interface AuthCookieOptions {
  /** Cookie name. Defaults to {@link authCookieName} — `config.auth.cookie.name`, else `auth-token`. */
  name?: string
  /** Lifetime in seconds. Defaults to the configured token expiry. */
  maxAge?: number
  /** Path the cookie is sent for. Defaults to `/`. */
  path?: string
  /** Domain, for sharing one session across subdomains. */
  domain?: string
  /**
   * Send only over HTTPS. Defaults to true outside local development, where
   * the dev server is plain HTTP and a Secure cookie would never be stored.
   */
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

/**
 * RFC 6265 cookie-name grammar: a `token`, i.e. any US-ASCII character except
 * CTLs and separators. A space, comma, semicolon or equals sign makes the
 * `Set-Cookie` header malformed.
 */
const COOKIE_NAME_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

/**
 * The one name the auth cookie has.
 *
 * There used to be two. `authCookie()` wrote `stacks_auth` (via
 * `config.auth.cookie.name`, a key that did not exist on `AuthOptions`, so no
 * app using `satisfies AuthConfig` could even set it), while the Auth
 * middleware, `team.ts` and the stx page gate all read
 * `config.auth.defaultTokenName` — `auth-token`. A cookie the framework wrote
 * was never one the framework read, which is why apps ended up hand-writing a
 * token pack into `localStorage` from an inline script instead
 * (stacksjs/stacks#2236).
 *
 * Resolution order:
 *   1. an explicit `options.name`
 *   2. `config.auth.cookie.name` — the supported key
 *   3. `config.auth.defaultTokenName` — DEPRECATED, honoured so an app that
 *      had renamed it (and thereby renamed the cookie those readers wanted)
 *      keeps working. Ignored with a warning when it is not a legal cookie
 *      name, which it very often is not: it is a human-readable token label
 *      like `Web Session`.
 *   4. `auth-token`
 */
export function authCookieName(options?: AuthCookieOptions): string {
  if (options?.name)
    return options.name

  const configured = (config.auth as any)?.cookie?.name
  if (typeof configured === 'string' && configured.length > 0)
    return configured

  const legacy = (config.auth as any)?.defaultTokenName
  if (typeof legacy === 'string' && legacy.length > 0 && legacy !== 'auth-token') {
    if (COOKIE_NAME_RE.test(legacy))
      return legacy

    // Falling back rather than emitting a malformed Set-Cookie. This is the
    // failure the overload made likely, so it says what to do about it.
    console.warn(
      `[auth] config.auth.defaultTokenName ("${legacy}") is not a valid cookie name and is being ignored `
      + `for cookie naming; using "auth-token". defaultTokenName is a personal access token label, not a `
      + `cookie name — set config.auth.cookie.name instead (stacksjs/stacks#2236).`,
    )
  }

  return 'auth-token'
}

function cookieName(options?: AuthCookieOptions): string {
  return authCookieName(options)
}

function defaultMaxAge(): number {
  // `config.auth.tokenExpiry` is milliseconds — the same value
  // `createTokenForUser` uses for the token's own `expires_at`, so the cookie
  // and the token it carries die together. A cookie wants seconds.
  const milliseconds = Number((config.auth as any)?.tokenExpiry ?? 60 * 60 * 1000)
  if (!Number.isFinite(milliseconds) || milliseconds <= 0)
    return 60 * 60

  return Math.max(60, Math.round(milliseconds / 1000))
}

function isLocal(): boolean {
  const environment = String((config.app as any)?.env ?? process.env.APP_ENV ?? '')
  return environment === 'local' || environment === 'development' || environment === 'dev'
}

/**
 * The `Set-Cookie` value that signs a browser in.
 *
 * Pair it with the token from `Auth.login()`:
 *
 * ```ts
 * const result = await Auth.login({ email, password })
 * return new Response(null, {
 *   status: 303,
 *   headers: { 'Location': '/account', 'Set-Cookie': authCookie(result.token) },
 * })
 * ```
 */
export function authCookie(token: string, options: AuthCookieOptions = {}): string {
  const parts = [
    `${cookieName(options)}=${encodeURIComponent(token)}`,
    `Path=${options.path ?? '/'}`,
    `Max-Age=${options.maxAge ?? defaultMaxAge()}`,
    'HttpOnly',
    `SameSite=${options.sameSite ?? 'Lax'}`,
  ]

  if (options.domain)
    parts.push(`Domain=${options.domain}`)

  if (options.secure ?? !isLocal())
    parts.push('Secure')

  return parts.join('; ')
}

/**
 * The `Set-Cookie` value that signs a browser out.
 *
 * Every attribute except the value has to match the cookie being replaced, or
 * the browser keeps the original alongside the expired one.
 */
export function clearAuthCookie(options: AuthCookieOptions = {}): string {
  return authCookie('', { ...options, maxAge: 0 })
}

/** The raw token in a request's auth cookie, if it carries one. */
export function authCookieToken(request: Request | { headers: Headers }, options: AuthCookieOptions = {}): string | undefined {
  const header = request.headers.get('cookie')
  if (!header)
    return undefined

  const wanted = cookieName(options)

  for (const pair of header.split(';')) {
    const index = pair.indexOf('=')
    if (index === -1)
      continue

    if (pair.slice(0, index).trim() !== wanted)
      continue

    const value = decodeURIComponent(pair.slice(index + 1).trim())
    return value.length > 0 ? value : undefined
  }

  return undefined
}

/**
 * The signed-in user for a server-rendered request, or undefined.
 *
 * Reads the cookie, then validates the token exactly as a bearer token would
 * be — a revoked or expired token yields undefined, so signing out on one
 * device takes effect on every page load elsewhere.
 */
export async function userFromCookie(
  request: Request | { headers: Headers },
  options: AuthCookieOptions = {},
): Promise<AuthenticatedUser> {
  const token = authCookieToken(request, options)
  if (!token)
    return undefined

  return Auth.getUserFromToken(token)
}

/** Whether a server-rendered request carries a valid session. */
export async function cookieCheck(
  request: Request | { headers: Headers },
  options: AuthCookieOptions = {},
): Promise<boolean> {
  return Boolean(await userFromCookie(request, options))
}

/**
 * Sign out the browser: revoke the token the cookie carries, then clear it.
 *
 * Revoking matters — without it a copied cookie stays valid for the token's
 * whole lifetime, and "log out on a shared computer" would only mean "hide
 * the key".
 */
export async function logoutCookie(
  request: Request | { headers: Headers },
  options: AuthCookieOptions = {},
): Promise<string> {
  const token = authCookieToken(request, options)

  if (token) {
    try {
      await Auth.revokeToken(token)
    }
    catch {
      // An already-revoked or malformed token is still a successful logout
      // from the browser's point of view; the cookie goes either way.
    }
  }

  return clearAuthCookie(options)
}
