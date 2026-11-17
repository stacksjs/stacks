/**
 * What a storefront cart costs once the store's automatic discounts are
 * applied: "buy 4, get 4 free", "5+ for 20% off", free shipping over a
 * threshold.
 *
 * One function prices for every page and for the checkout, so the cart,
 * each checkout step and the order PlaceOrderAction writes all agree. The
 * pages read SQLite synchronously (see `StorefrontDatabase.ts`), and the
 * action reads through the framework's database; both hand their rows to
 * {@link priceStorefront}, which is pure.
 *
 * Amounts are integer minor units of the cart's currency.
 */

import type { DiscountResult, DiscountRule } from '@stacksjs/commerce/discounts/engine'
import type { DiscountRow } from '@stacksjs/commerce/discounts/rules'
import type { Database } from 'bun:sqlite'
import { applyDiscounts } from '@stacksjs/commerce/discounts/engine'
import { ruleFromDiscount } from '@stacksjs/commerce/discounts/rules'
import { freeShippingThreshold, shippingFor } from '../Actions/Storefront/_shipping'
import { storefrontMoney } from './StorefrontMoney'

export interface StorefrontLine {
  /** The cart item's id. */
  id: number
  productId: number
  categoryId?: number | null
  quantity: number
  unitPrice: number
  compareAtPrice?: number | null
}

export interface StorefrontPrice {
  result: DiscountResult
  subtotal: number
  discount: number
  /** Shipping after any free-shipping discount. */
  shipping: number
  total: number
  /** Minor units more needed for the flat free-shipping rule, or 0. */
  remainingForFree: number
}

/**
 * Price lines against rules. Shipping follows the storefront's rule on the
 * subtotal after discounts, and a free-shipping discount can then waive it.
 */
export function priceStorefront(lines: readonly StorefrontLine[], rules: readonly DiscountRule[], currency: string, now: Date = new Date()): StorefrontPrice {
  const first = applyDiscounts({ lines, rules, now })
  const baseShipping = shippingFor(first.discountedSubtotal, currency)
  const result = applyDiscounts({ lines, rules, shipping: baseShipping, now })
  return {
    result,
    subtotal: result.subtotal,
    discount: result.discount,
    shipping: result.shippingAfterDiscount,
    total: result.total,
    remainingForFree: baseShipping > 0 && result.shippingAfterDiscount > 0
      ? Math.max(0, freeShippingThreshold(currency) - result.discountedSubtotal)
      : 0,
  }
}

/**
 * The store's automatic discounts, read from SQLite for a server-rendered
 * page. A database without the `discounts` table (not migrated since it was
 * added) has none, rather than an empty cart.
 */
export function readAutomaticDiscounts(db: Database): DiscountRule[] {
  try {
    const rows = db.query<DiscountRow, []>(`SELECT * FROM discounts WHERE code IS NULL`).all()
    const rules: DiscountRule[] = []
    for (const row of rows) {
      try {
        rules.push(ruleFromDiscount(row))
      }
      catch {
        // A row the engine cannot read is skipped, never the whole cart.
      }
    }
    return rules
  }
  catch {
    return []
  }
}

interface CartLineRow {
  id: number
  quantity: number | string
  unit_price: number | string
  product_id: number | null
  category_id: number | null
}

/** A cart's lines, joined to their products, for {@link priceStorefront}. */
export function readCartLines(db: Database, cartId: number): StorefrontLine[] {
  const query = (category: string) => db.query<CartLineRow, [number]>(`
    SELECT ci.id, ci.quantity, ci.unit_price, p.id AS product_id, ${category} AS category_id
    FROM cart_items ci
    LEFT JOIN products p ON p.slug = ci.product_sku
    WHERE ci.cart_id = ?1
    ORDER BY ci.id ASC
  `).all(cartId)

  let rows: CartLineRow[]
  try {
    rows = query('p.category_id')
  }
  catch {
    // An older products table without categories still prices; category
    // targeted discounts just do not match it.
    rows = query('NULL')
  }

  return rows
    .filter(row => row.product_id != null && Number(row.quantity) > 0)
    .map(row => ({
      id: Number(row.id),
      productId: Number(row.product_id),
      categoryId: row.category_id == null ? null : Number(row.category_id),
      quantity: Number(row.quantity),
      unitPrice: Math.round(Number(row.unit_price)),
    }))
}

export interface StorefrontPricedSummary {
  subtotal: number
  discount: number
  shipping: number
  total: number
  subtotalLabel: string
  shippingLabel: string
  totalLabel: string
  freeShippingNote: string
  /** "-$10.00", or empty when nothing was taken off. */
  discountLabel: string
  /** The discounts applied, joined: "BUY 4, GET 4 FREE". */
  discountTitle: string
}

/**
 * A cart's priced totals as the order summary shows them, or null when they
 * cannot be worked out, so the page falls back to its undiscounted summary
 * rather than to an empty cart.
 */
export function storefrontCartSummary(db: Database, cartId: number, currency: string): StorefrontPricedSummary | null {
  try {
    const priced = priceStorefront(readCartLines(db, cartId), readAutomaticDiscounts(db), currency)
    return pricedSummary(priced, currency)
  }
  catch (error) {
    console.warn(`[storefront] cart ${cartId} priced without discounts: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

/** Labels for a priced cart. */
export function pricedSummary(priced: StorefrontPrice, currency: string): StorefrontPricedSummary {
  const merchandise = priced.result.applied.filter(a => a.class !== 'shipping')
  return {
    subtotal: priced.subtotal,
    discount: priced.discount,
    shipping: priced.shipping,
    total: priced.total,
    subtotalLabel: storefrontMoney(priced.subtotal, currency),
    shippingLabel: priced.shipping === 0 ? 'Free' : storefrontMoney(priced.shipping, currency),
    totalLabel: storefrontMoney(priced.total, currency),
    freeShippingNote: priced.remainingForFree > 0
      ? `Add ${storefrontMoney(priced.remainingForFree, currency)} more for free shipping.`
      : '',
    discountLabel: priced.discount > 0 ? `-${storefrontMoney(priced.discount, currency)}` : '',
    discountTitle: merchandise.map(a => a.title).join(', '),
  }
}
