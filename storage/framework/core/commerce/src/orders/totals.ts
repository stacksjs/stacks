/**
 * Server-side order-total recomputation (stacksjs/stacks#1879 Co-13).
 *
 * Background: the pre-fix `placeOrder` path trusted whatever
 * `total_amount` the client supplied on the order row. A client
 * could submit `total_amount: 0.01` and the order would persist
 * at that amount (Stripe-side might catch it if the payment
 * intent's amount field disagrees, but the LOCAL order record
 * was already wrong). Worse: a benign client whose cart total
 * drifted (price change between cart view and checkout) would
 * silently charge the wrong amount with no signal.
 *
 * This module ships a `recomputeOrderTotals(input)` helper that
 * derives subtotal + tax + shipping + discount from the line
 * items + current product prices + current tax rates + current
 * shipping rates, returns the canonical totals, and (optionally)
 * compares against a client-supplied total to flag drift.
 *
 * Caller pattern:
 *   1. Build the line-items array from the cart (server-side)
 *   2. Call `recomputeOrderTotals({ items, ... })` to get canonical numbers
 *   3. If `result.diffCents > MAX_DRIFT_CENTS`, reject with "price changed"
 *   4. Use `result.total` as the authoritative order.total_amount
 *
 * Currency: all amounts are integer cents (or your currency's smallest
 * unit). Float arithmetic on money is a known footgun (#1879 Co-12);
 * cents avoid the rounding-error class entirely.
 */

import { db } from '@stacksjs/database'

export interface RecomputeLineItem {
  /** Product ID — used to look up the current canonical unit price. */
  productId: number
  /** Quantity ordered. */
  quantity: number
  /**
   * Optional override unit price in cents. When set, used INSTEAD
   * of the product table lookup — for grandfathered prices, admin
   * discounts, or B2B contract pricing. Document the override in
   * the order metadata so the audit trail is traceable.
   */
  unitPriceCents?: number
}

export interface RecomputeOrderInput {
  /** Server-built line items. Quantities and product IDs only — prices
   *  default to the products table. */
  items: ReadonlyArray<RecomputeLineItem>
  /** Optional tax rate ID to apply. Looked up server-side; rate is
   *  applied to subtotal AFTER discount. */
  taxRateId?: number
  /** Optional shipping rate cents. Apps that pre-validate the zone
   *  (#1879 Co-11) pass the resolved cost here. */
  shippingCents?: number
  /** Optional flat discount in cents (e.g. from coupon). Applied to
   *  subtotal before tax. */
  discountCents?: number
  /** Optional client-supplied total in cents for drift detection. */
  clientTotalCents?: number
  /** Max acceptable drift between client total and canonical total,
   *  default 5 cents. Drift past this returns `priceChanged: true`. */
  maxDriftCents?: number
}

export interface RecomputeOrderResult {
  /** Sum of line-item subtotals (qty × unit price) in cents. */
  subtotalCents: number
  /** Discount applied (>= 0). */
  discountCents: number
  /** Tax in cents, computed from (subtotal - discount) × rate. */
  taxCents: number
  /** Shipping cost in cents. */
  shippingCents: number
  /** Final total: subtotal - discount + tax + shipping. */
  totalCents: number
  /** Per-line resolved unit prices, for the audit trail. */
  resolvedItems: Array<{ productId: number, quantity: number, unitPriceCents: number, lineCents: number }>
  /** Set when `clientTotalCents` was provided and differs from
   *  canonical by more than `maxDriftCents`. Caller should reject
   *  the checkout and ask the user to re-confirm. */
  priceChanged: boolean
  /** Absolute drift in cents (always >= 0). */
  diffCents: number
}

/**
 * Fetch the current canonical unit price for each product id.
 * Bulk single-query so a 10-item cart isn't a 10-query stampede.
 * Returns a Map keyed by product id.
 */
async function fetchProductPrices(ids: number[]): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map()
  const rows = await (db as any)
    .selectFrom('products')
    .where('id', 'in', ids)
    .select(['id', 'price'])
    .execute() as Array<{ id: number, price: number | string }>
  const out = new Map<number, number>()
  for (const r of rows) {
    // Some schemas store price as DECIMAL/string — coerce to cents.
    // We assume `price` is in cents already (that's the framework
    // convention since money math should never touch floats); a
    // string-stored numeric coerces cleanly via Number().
    const cents = Number(r.price)
    if (Number.isFinite(cents))
      out.set(r.id, Math.round(cents))
  }
  return out
}

/**
 * Look up a tax rate by id and return its decimal multiplier
 * (e.g. `0.0875` for 8.75% sales tax). Returns 0 when the id is
 * missing or the lookup fails — the caller already passed
 * `taxRateId` deliberately, so a missing rate is a config bug
 * worth surfacing via the canonical total being wrong.
 */
async function fetchTaxRate(id: number): Promise<number> {
  try {
    const row = await (db as any)
      .selectFrom('tax_rates')
      .where('id', '=', id)
      .select(['rate'])
      .executeTakeFirst()
    const rate = Number(row?.rate ?? 0)
    return Number.isFinite(rate) ? rate : 0
  }
  catch {
    return 0
  }
}

export async function recomputeOrderTotals(input: RecomputeOrderInput): Promise<RecomputeOrderResult> {
  // Lookups happen up-front so the rest of the function is pure
  // arithmetic against in-memory data — easier to reason about
  // and easier to mock in tests.
  const productIds = input.items.map(i => i.productId)
  const priceMap = await fetchProductPrices(productIds)
  const taxRate = input.taxRateId != null ? await fetchTaxRate(input.taxRateId) : 0

  let subtotalCents = 0
  const resolvedItems: RecomputeOrderResult['resolvedItems'] = []

  for (const item of input.items) {
    // Prefer the caller's explicit override (admin discount, B2B
    // contract pricing) over the products-table lookup.
    const unitCents = item.unitPriceCents ?? priceMap.get(item.productId) ?? 0
    const lineCents = Math.round(unitCents * item.quantity)
    subtotalCents += lineCents
    resolvedItems.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPriceCents: unitCents,
      lineCents,
    })
  }

  const discountCents = Math.max(0, input.discountCents ?? 0)
  // Tax applies to (subtotal - discount), clamped to non-negative.
  const taxableCents = Math.max(0, subtotalCents - discountCents)
  // Round half-up at the cent boundary to match how most payment
  // processors round (Stripe documents this).
  const taxCents = Math.round(taxableCents * taxRate)
  const shippingCents = Math.max(0, input.shippingCents ?? 0)
  const totalCents = subtotalCents - discountCents + taxCents + shippingCents

  // Drift detection against client-supplied total. Default tolerance
  // is 5 cents — covers most rounding-disagreement cases (one side
  // rounded a quarter-cent up, the other rounded it down) without
  // hiding genuine price changes.
  const maxDrift = input.maxDriftCents ?? 5
  let priceChanged = false
  let diffCents = 0
  if (input.clientTotalCents != null) {
    diffCents = Math.abs(totalCents - input.clientTotalCents)
    priceChanged = diffCents > maxDrift
  }

  return {
    subtotalCents,
    discountCents,
    taxCents,
    shippingCents,
    totalCents,
    resolvedItems,
    priceChanged,
    diffCents,
  }
}
