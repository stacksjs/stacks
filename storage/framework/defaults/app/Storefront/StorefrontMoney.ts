/**
 * Money on the storefront's server-rendered pages.
 *
 * `cart_items.unit_price`, `cart_items.total_price`, `order_items.price`
 * and `orders.total_amount` hold integer minor units (1999 is $19.99), as
 * every commerce amount does. The cart, checkout and order pages used to
 * print them with a hardcoded `$` and `.toFixed(2)`, which showed a 1999
 * cent product as $1999.00 and ignored the cart's currency. They format
 * through `@stacksjs/commerce/money` here instead.
 */

import { formatCurrency } from '@stacksjs/commerce/money'
import { totalsFor } from '../Actions/Storefront/_shipping'

/** The currency a cart or order row was priced in, or USD when it has none. */
export function storefrontCurrency(stored: unknown): string {
  const code = String(stored ?? '').trim().toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : 'USD'
}

/** A stored minor-unit amount, formatted for the shopper: `1999, 'USD'` is `"$19.99"`. */
export function storefrontMoney(minor: number, currency: string): string {
  return formatCurrency(minor, currency)
}

export interface StorefrontSummaryLabels {
  subtotal: number
  shipping: number
  total: number
  subtotalLabel: string
  shippingLabel: string
  totalLabel: string
  freeShippingNote: string
}

/**
 * The running totals the cart and checkout pages show, from the lines'
 * subtotal in minor units. Shipping comes from the same rule the
 * place-order action charges with, so the two cannot disagree.
 */
export function storefrontSummary(subtotal: number, currency: string): StorefrontSummaryLabels {
  const totals = totalsFor(subtotal, currency)
  return {
    subtotal: totals.subtotal,
    shipping: totals.shipping,
    total: totals.total,
    subtotalLabel: storefrontMoney(totals.subtotal, currency),
    shippingLabel: totals.shipping === 0 ? 'Free' : storefrontMoney(totals.shipping, currency),
    totalLabel: storefrontMoney(totals.total, currency),
    freeShippingNote: totals.remainingForFree > 0
      ? `Add ${storefrontMoney(totals.remainingForFree, currency)} more for free shipping.`
      : '',
  }
}
