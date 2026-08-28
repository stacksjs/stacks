/**
 * Read the storefront cart token out of the request.
 *
 * The cart and the three checkout steps each opened with
 *
 *     const token = (typeof requestContext !== 'undefined')
 *       ? requestContext.cookie('stacks_cart')
 *       : null
 *
 * and `requestContext` is not a binding stx has ever put in a server script's
 * scope. It is the NAME OF A PARAMETER inside the template hydrator, and the
 * page context a server assembles carries `params`, `request` and `method`.
 * So the `typeof` guard was always false, `token` was always null, and every
 * one of those pages rendered its empty-cart branch no matter what was in the
 * cart. The guard is what hid it: without it the pages would have thrown on
 * the first request instead of quietly showing nothing.
 *
 * `request` is really provided, so the cookie is read from its header.
 */

/** The cookie the storefront stores its cart session token in. */
export const CART_COOKIE = 'stacks_cart'

/**
 * The value of `name` in a request's Cookie header, or null.
 *
 * Values are percent-encoded on the way in, so they are decoded here. A
 * malformed encoding yields the raw value rather than throwing, since a
 * cookie is attacker-supplied and a render must not fail on one.
 */
export function cookieFromRequest(request: Request | undefined, name: string): string | null {
  const header = request?.headers?.get('cookie')
  if (!header)
    return null

  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index < 0)
      continue
    if (part.slice(0, index).trim() !== name)
      continue

    const raw = part.slice(index + 1).trim()
    try {
      return decodeURIComponent(raw)
    }
    catch {
      return raw
    }
  }

  return null
}

/** The storefront cart token carried by this request, or null. */
export function cartTokenFromRequest(request: Request | undefined): string | null {
  return cookieFromRequest(request, CART_COOKIE)
}
