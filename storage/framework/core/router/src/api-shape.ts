/**
 * "Is this request JSON-shaped?" — the single source of truth used across
 * the framework to decide JSON vs HTML for responses (errors, primitives,
 * empty results) and to widen request-body parsing to every JSON variant.
 *
 * The historical bug was scattered ad-hoc checks: `error-handler` looked at
 * `Accept`, `formatResult` ignored the request entirely, `parseRequestBody`
 * did `contentType.includes('application/json')` so `application/vnd.api+json`
 * went unparsed. Centralizing the decision here means a future tweak (e.g.,
 * treating an `apiResponse: true` route group as always-JSON) lands in one
 * place and every response path picks it up.
 */

/**
 * Matches `application/json` plus any RFC-6838 structured-suffix subtype:
 * `application/vnd.api+json`, `application/ld+json`, `application/hal+json`,
 * `application/problem+json`, etc. Case-insensitive; tolerates a trailing
 * `;` (for `;charset=utf-8`) or end-of-string.
 */
export const JSON_CONTENT_TYPE = /^application\/(?:json|.+\+json)(?:;|$)/i

/**
 * Returns true when responses to this request should default to JSON.
 *
 * Decision order (first match wins):
 *
 *   1. `Content-Type` matches {@link JSON_CONTENT_TYPE} — the client sent
 *      JSON, the framework reciprocates.
 *   2. `Sec-Fetch-Dest: document` — explicit top-level browser navigation;
 *      negative signal that takes priority over any `Accept: *\/*` fallback.
 *   3. `Accept` contains `text/html` — explicit HTML opt-in (the header
 *      browsers send for nav: `text/html,application/xhtml+xml,…`).
 *   4. Otherwise → JSON. This covers `Accept: *\/*` (browser `fetch()`
 *      default), `Accept: application/json`, curl's default, and API
 *      clients that omit the header entirely.
 *
 * The previous logic in `createErrorResponse` required `Accept:
 * application/json` *explicitly*, which leaked the dev HTML error page
 * into every `fetch()` call (because fetch defaults to `Accept: *\/*`,
 * not `application/json`). This predicate fixes that asymmetry by making
 * JSON the default unless the client explicitly opts into HTML.
 */
export function isApiRequest(req: Request | { headers: Headers }): boolean {
  const headers = req.headers

  const contentType = headers.get('content-type') || ''
  if (JSON_CONTENT_TYPE.test(contentType)) return true

  // Explicit browser navigation — never JSON-shaped, regardless of Accept.
  // Browsers also send this for top-level redirects, so it's a stronger
  // signal than the Accept header alone.
  if (headers.get('sec-fetch-dest') === 'document') return false

  const accept = headers.get('accept') || ''
  if (accept.includes('text/html')) return false

  // No HTML signal anywhere — assume the caller wants JSON. Covers:
  //   - `Accept: */*`            (browser fetch default, curl default)
  //   - `Accept: application/json` (API clients that bother to set it)
  //   - no Accept header at all   (most HTTP libraries' default)
  //   - `X-Requested-With: XMLHttpRequest` (legacy XHR clients)
  return true
}
