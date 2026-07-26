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
  /** Cookie name. Defaults to `config.auth.cookie.name` or `stacks_auth`. */
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

function cookieName(options?: AuthCookieOptions): string {
  return options?.name ?? (config.auth as any)?.cookie?.name ?? 'stacks_auth'
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
