/// <reference lib="dom" />

/**
 * CSRF token plumbing for browser requests.
 *
 * The framework's CSRF middleware is default-on for unsafe methods and uses a
 * stateless double-submit cookie: the server sets a non-HttpOnly
 * `X-CSRF-Token` cookie on safe responses, and the client is expected to echo
 * that value back in the `X-CSRF-Token` header. Nothing in the browser package
 * did the echoing, so every cookie-authenticated POST the framework itself
 * issues — login, register, logout — came back 403 "CSRF token mismatch" on a
 * stock install.
 */

/** Cookie (and header) name the CSRF middleware issues and checks. */
export const CSRF_COOKIE_NAME = 'X-CSRF-Token'

/**
 * Read the CSRF token the server planted, or null when there is none.
 *
 * Returns null rather than throwing outside a browser so server-side rendering
 * and tests can call this freely.
 */
export function readCsrfToken(cookieSource?: string): string | null {
  const raw = cookieSource ?? (typeof document !== 'undefined' ? document.cookie : '')
  if (!raw)
    return null

  for (const part of raw.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1)
      continue

    const name = part.slice(0, separator).trim()
    if (name !== CSRF_COOKIE_NAME)
      continue

    const value = part.slice(separator + 1).trim()
    return value ? decodeURIComponent(value) : null
  }

  return null
}

/**
 * Add the CSRF header to a set of request headers.
 *
 * A bearer token already exempts the request server-side, so the header is
 * only added when there is a cookie to echo. Existing values win: an explicit
 * caller-supplied token is never overwritten.
 */
export function withCsrfHeader(
  headers: Record<string, string> = {},
  cookieSource?: string,
): Record<string, string> {
  if (headers[CSRF_COOKIE_NAME])
    return headers

  const token = readCsrfToken(cookieSource)
  if (!token)
    return headers

  return { ...headers, [CSRF_COOKIE_NAME]: token }
}
