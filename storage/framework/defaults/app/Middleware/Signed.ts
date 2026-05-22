import { Middleware, verifySignedUrl } from '@stacksjs/router'

/**
 * Signed-URL verification middleware (stacksjs/stacks#1870 R-7).
 *
 * Verifies the HMAC `signature` (and optional `expires`) on the request
 * URL using the same `APP_KEY` / `STACKS_SIGNED_URL_SECRET` the
 * `signedUrl(...)` builder signs with. Drop in as `.middleware('signed')`
 * on any route minted by `signedUrl(...)`.
 *
 * Status codes:
 *   - `410 Gone`         — expired (link existed but is no longer valid)
 *   - `401 Unauthorized` — missing signature or tampered URL
 *
 * The two cases are split so callers can distinguish "your link timed
 * out, request a new one" from "this URL didn't come from us" in their
 * frontend UX.
 *
 * Priority `5` so this runs ahead of auth (which defaults to 10) — a
 * URL with a bad signature shouldn't get as far as the auth chain.
 */
export default new Middleware({
  name: 'Signed',
  priority: 5,
  async handle(request) {
    const result = verifySignedUrl(request.url)
    if (result.valid) return
    const status = result.reason === 'expired' ? 410 : 401
    throw Response.json({ error: result.reason }, { status })
  },
})
