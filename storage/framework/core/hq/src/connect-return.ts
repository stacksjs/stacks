/**
 * Coming back to the `buddy hq:connect` approve page after signing in.
 *
 * Somebody who opens an approve link signed out is sent to sign in. Before
 * this, sign-in went where it always goes, and the person took that for the
 * connect having worked: the page that asks for the confirmation code was a
 * tab they never went back to, and the terminal timed out.
 *
 * The return path travels in the address bar, which anyone can write, so it
 * is never followed as given. It is honoured only when it is exactly the
 * approve page on this site with a well-formed code; anything else, including
 * an absolute URL or a path that merely starts the same way, answers nothing
 * and the caller goes where it always went. A sign-in page that redirects
 * wherever its query string says is a phishing tool with the site's own name
 * on it.
 *
 * Its own subpath, `@stacksjs/hq/connect-return`, and free of imports, so a
 * page's client script can use it without the rest of the package following
 * it into the browser. The path is the one every service's `approveUrl`
 * answers, `/cli/connect?code=`.
 */

/** A connect code is 32 random bytes as base64url: letters, digits, `-` and `_`. */
const CODE = /^[\w-]{16,128}$/
const CONNECT_PATH = /^\/cli\/connect\?code=[\w-]{16,128}$/

/** The approve page for this code, or nothing when the code is not one. */
export function connectPath(code: unknown): string {
  const value = String(code ?? '')
  return CODE.test(value) ? `/cli/connect?code=${value}` : ''
}

/**
 * The approve page a sign-in was asked to return to, or nothing.
 *
 * `next` is the query value as the router gives it: a string, a list when the
 * parameter is repeated (only its first value counts), or absent.
 */
export function connectReturn(next: unknown): string {
  const path = Array.isArray(next) ? String(next[0] ?? '') : String(next ?? '')
  return CONNECT_PATH.test(path) ? path : ''
}

/** A sign-in or register link that comes back to the approve page afterwards. */
export function withConnectReturn(page: '/login' | '/register', code: unknown): string {
  const path = connectPath(code)
  return path ? `${page}?next=${encodeURIComponent(path)}` : page
}
