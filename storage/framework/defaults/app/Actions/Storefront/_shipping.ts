import { currencyExponent, decimalToMinor } from '@stacksjs/commerce/money'

/**
 * Shipping rules used by both the cart and checkout views and the
 * place-order action.
 *
 * Centralized so the price the shopper sees and the total they're charged
 * can't drift: the views read their totals through
 * `app/Storefront/StorefrontMoney.ts`, which calls {@link totalsFor} here.
 *
 * Every amount in and out is integer minor units of the cart's currency,
 * like `cart_items.total_price` and `orders.total_amount` (1999 is $19.99).
 * The thresholds were plain numbers compared against those cents, so the
 * default "free over 40" meant free over 40 cents and the flat rate was
 * five cents.
 *
 * Override per-app with `STOREFRONT_FREE_SHIPPING_THRESHOLD` and
 * `STOREFRONT_FLAT_SHIPPING`, written as major-unit decimals the way a
 * person says them (`40`, `4.99`) and converted to the currency's minor
 * unit here, or by editing this file in the application's own
 * `app/Actions/Storefront/_shipping.ts` if the rule needs more logic than
 * two numbers (per-region, weight-based, etc.).
 */

const DEFAULT_FREE_SHIPPING_THRESHOLD = '40'
const DEFAULT_FLAT_SHIPPING = '5'

/** Subtotal, in minor units of `currency`, at or above which shipping is free. */
export function freeShippingThreshold(currency: string): number {
  return minorFromEnv('STOREFRONT_FREE_SHIPPING_THRESHOLD', DEFAULT_FREE_SHIPPING_THRESHOLD, currency)
}

/** The flat shipping fee, in minor units of `currency`. */
export function flatShipping(currency: string): number {
  return minorFromEnv('STOREFRONT_FLAT_SHIPPING', DEFAULT_FLAT_SHIPPING, currency)
}

/**
 * The shipping fee for a subtotal, both in minor units of `currency`.
 * Empty cart → 0, otherwise free at/above the threshold, otherwise the
 * flat rate.
 */
export function shippingFor(subtotal: number, currency: string): number {
  if (!Number.isFinite(subtotal) || subtotal <= 0)
    return 0
  if (subtotal >= freeShippingThreshold(currency))
    return 0
  return flatShipping(currency)
}

/**
 * `{ subtotal, shipping, total, remainingForFree }` for a subtotal, all in
 * minor units of `currency`: the shape both the views and the place-order
 * action want, with the shipping rule applied consistently.
 */
export function totalsFor(subtotal: number, currency: string): {
  subtotal: number
  shipping: number
  total: number
  remainingForFree: number
} {
  const sub = Number.isFinite(subtotal) ? Math.round(subtotal) : 0
  const shipping = shippingFor(sub, currency)
  return {
    subtotal: sub,
    shipping,
    total: sub + shipping,
    remainingForFree: shipping > 0 ? Math.max(0, freeShippingThreshold(currency) - sub) : 0,
  }
}

function minorFromEnv(name: string, fallback: string, currency: string): number {
  const exponent = currencyExponent(currency)
  const raw = (typeof process !== 'undefined' && process.env)
    ? process.env[name]
    : undefined

  if (raw !== undefined && raw.trim() !== '') {
    try {
      const parsed = decimalToMinor(raw, exponent)
      if (parsed !== null)
        return parsed
    }
    catch {
      // An unreadable value falls back to the default, as it always has.
    }
  }

  return decimalToMinor(fallback, exponent) ?? 0
}
