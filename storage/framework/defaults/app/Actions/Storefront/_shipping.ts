/**
 * Shipping rules used by both the cart view and the place-order action.
 *
 * Centralized so a copy in cart.stx and another in PlaceOrderAction.ts
 * can't drift — when finance changes "free shipping over $40" to
 * "free over $50" you don't want one of the two surfaces (the price
 * the shopper sees vs. the total they're charged) to lag the other.
 *
 * Override per-app by setting `STOREFRONT_FREE_SHIPPING_THRESHOLD` and
 * `STOREFRONT_FLAT_SHIPPING` in the environment, or by editing this
 * file in the application's own `app/Actions/Storefront/_shipping.ts`
 * if the rule needs more logic than two numbers (per-region, weight-
 * based, etc.).
 */

const DEFAULT_FREE_SHIPPING_THRESHOLD = 40
const DEFAULT_FLAT_SHIPPING = 5

export const FREE_SHIPPING_THRESHOLD = numFromEnv(
  'STOREFRONT_FREE_SHIPPING_THRESHOLD',
  DEFAULT_FREE_SHIPPING_THRESHOLD,
)

export const FLAT_SHIPPING = numFromEnv(
  'STOREFRONT_FLAT_SHIPPING',
  DEFAULT_FLAT_SHIPPING,
)

/**
 * Compute the shipping fee for a given subtotal. Empty cart → 0,
 * otherwise free at/above the threshold, otherwise the flat rate.
 */
export function shippingFor(subtotal: number): number {
  if (!Number.isFinite(subtotal) || subtotal <= 0)
    return 0
  if (subtotal >= FREE_SHIPPING_THRESHOLD)
    return 0
  return FLAT_SHIPPING
}

/**
 * Return `{ subtotal, shipping, total }` for a given subtotal — the
 * shape both the cart view and the place-order action want, with the
 * shipping rule applied consistently.
 */
export function totalsFor(subtotal: number): {
  subtotal: number
  shipping: number
  total: number
} {
  const sub = Number.isFinite(subtotal) ? subtotal : 0
  const shipping = shippingFor(sub)
  return { subtotal: sub, shipping, total: sub + shipping }
}

function numFromEnv(name: string, fallback: number): number {
  const raw = (typeof process !== 'undefined' && process.env)
    ? process.env[name]
    : undefined
  if (raw === undefined || raw === '')
    return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}
