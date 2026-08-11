import type { AuthCookieOptions } from './cookie'
import { authCookieToken, clearAuthCookie } from './cookie'
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
 * not), and Secure everywhere except a plain-HTTP loopback app URL — see
 * `shouldSecureAuthCookie` for exactly how that is decided.
 */

// The cookie value itself — naming, attributes, parsing — lives in ./cookie so
// authentication.ts can read it without importing this module back. Re-exported
// here because this is the documented entry point for cookie auth.
export type { AuthCookieOptions } from './cookie'
export { authCookie, authCookieName, authCookieToken, clearAuthCookie, shouldSecureAuthCookie } from './cookie'

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
