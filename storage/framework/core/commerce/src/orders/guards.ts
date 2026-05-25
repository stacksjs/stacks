/**
 * Order / cart policy guards (stacksjs/stacks#1879 Co-7, Co-14, Co-15).
 *
 * Three small helpers that callers pre-flight against the cart
 * before handing off to `placeOrder`. Kept together because they
 * all answer the same question: "should this checkout be
 * allowed to proceed?"
 */

import { db } from '@stacksjs/database'

// ============================================================================
// Co-7: coupon stacking guard
// ============================================================================

export interface CouponStackingPolicy {
  /**
   * Allow multiple coupons on the same order. Default is `false`
   * (single-coupon-only). Apps that intentionally stack coupons
   * (e.g. one fixed-amount + one percentage) opt in explicitly.
   */
  allowMultiple?: boolean
  /**
   * When `allowMultiple: true`, cap the number of stacked coupons.
   * Default unlimited (no cap). Useful for "up to 2 coupons" or
   * "BOGO + free-shipping" style rules.
   */
  maxStacked?: number
}

export interface CouponStackingResult {
  ok: boolean
  /** Number of coupon ids the caller submitted. */
  count: number
  /** Set when the policy rejected the combination. */
  reason?: 'multiple-not-allowed' | 'exceeds-max-stacked'
}

/**
 * Validate that a set of coupon ids satisfies the stacking policy
 * (stacksjs/stacks#1879 Co-7). Pre-fix there was no enforcement
 * anywhere — frontend could submit two coupons and double-discount
 * the order with no signal. Default policy is single-coupon-only;
 * apps that intentionally support stacking opt in.
 *
 * @example
 * ```ts
 * const stack = validateCouponStacking(cart.couponIds)
 * if (!stack.ok)
 *   throw new HttpError(400, `Coupon stacking violation: ${stack.reason}`)
 * ```
 */
export function validateCouponStacking(
  couponIds: ReadonlyArray<number>,
  policy: CouponStackingPolicy = {},
): CouponStackingResult {
  const count = couponIds.length
  if (count <= 1) return { ok: true, count }
  if (!policy.allowMultiple) {
    return { ok: false, count, reason: 'multiple-not-allowed' }
  }
  const cap = policy.maxStacked ?? Number.POSITIVE_INFINITY
  if (count > cap) {
    return { ok: false, count, reason: 'exceeds-max-stacked' }
  }
  return { ok: true, count }
}

// ============================================================================
// Co-14: min/max order quantity bounds
// ============================================================================

export interface QuantityBoundsResult {
  ok: boolean
  productId: number
  quantity: number
  /** Set when the quantity violated a bound. */
  reason?: 'below-min' | 'above-max' | 'non-positive' | 'product-missing'
  /** The bound that was violated (when applicable). */
  bound?: number
}

/**
 * Validate that a cart line-item's quantity respects the product's
 * `min_order_qty` / `max_order_qty` fields
 * (stacksjs/stacks#1879 Co-14). Looks up the product server-side
 * so the client can't bypass by lying about the bounds.
 *
 * Products without explicit bounds default to "any positive int."
 * A quantity of 0 or negative always fails — the cart's UI is
 * responsible for letting users remove items, not for passing
 * sentinel zeros through the API.
 */
export async function validateQuantityBounds(
  productId: number,
  quantity: number,
): Promise<QuantityBoundsResult> {
  if (!Number.isFinite(quantity) || quantity <= 0)
    return { ok: false, productId, quantity, reason: 'non-positive' }

  let product: { min_order_qty?: number | null, max_order_qty?: number | null } | undefined
  try {
    product = await (db as any)
      .selectFrom('products')
      .where('id', '=', productId)
      .select(['min_order_qty', 'max_order_qty'])
      .executeTakeFirst()
  }
  catch {
    // Schema doesn't have the columns yet — degrade to "any positive
    // quantity is fine," matching the pre-fix behavior. Apps that
    // need bounds enforcement add the columns first.
    return { ok: true, productId, quantity }
  }

  if (!product)
    return { ok: false, productId, quantity, reason: 'product-missing' }

  const min = product.min_order_qty ?? null
  const max = product.max_order_qty ?? null

  if (min != null && quantity < min)
    return { ok: false, productId, quantity, reason: 'below-min', bound: min }
  if (max != null && quantity > max)
    return { ok: false, productId, quantity, reason: 'above-max', bound: max }

  return { ok: true, productId, quantity }
}

/**
 * Batch variant — short-circuits on the first violation so the
 * caller can surface a single useful "item X has min qty Y"
 * error rather than a list of every failed line.
 */
export async function validateCartQuantities(
  items: ReadonlyArray<{ productId: number, quantity: number }>,
): Promise<QuantityBoundsResult> {
  for (const item of items) {
    const r = await validateQuantityBounds(item.productId, item.quantity)
    if (!r.ok) return r
  }
  // ok-path uses the last item's id as a placeholder; callers
  // only branch on `.ok`.
  const last = items[items.length - 1] ?? { productId: 0, quantity: 0 }
  return { ok: true, productId: last.productId, quantity: last.quantity }
}

// ============================================================================
// Co-15: abandoned cart cleanup
// ============================================================================

export interface CleanupAbandonedCartsOptions {
  /**
   * Delete carts whose `updated_at` is older than this many days.
   * Default 30. Apps with rolling-window cart-recovery emails set
   * higher (e.g. 90).
   */
  olderThanDays?: number
  /**
   * Maximum rows to delete in a single call. Default 1000 — keeps
   * the delete from holding a long write lock on busy databases.
   * Apps call repeatedly until `deleted < limit`.
   */
  limit?: number
}

export interface CleanupAbandonedCartsResult {
  /** Number of cart rows deleted in this call. */
  deleted: number
  /** Cutoff timestamp used for the delete (ISO 8601). */
  cutoffAt: string
}

/**
 * Delete carts that have been untouched for more than
 * `olderThanDays` days (stacksjs/stacks#1879 Co-15). Default 30.
 * Capped at `limit` rows per call (default 1000) so the delete
 * doesn't hold a long write lock on a busy database. Returns the
 * count + cutoff so callers can log or loop.
 *
 * Schedule via `@stacksjs/scheduler` (now fully wired since
 * #1877's scheduler audit closed) to run nightly:
 *
 * @example
 * ```ts
 * // app/Scheduler.ts
 * import { cleanupAbandonedCarts } from '@stacksjs/commerce'
 *
 * schedule.job(async () => {
 *   let total = 0
 *   while (true) {
 *     const r = await cleanupAbandonedCarts({ olderThanDays: 30, limit: 1000 })
 *     total += r.deleted
 *     if (r.deleted < 1000) break
 *   }
 *   log.info(`Cleaned up ${total} abandoned carts`)
 * }).daily().setTimeZone('UTC').withName('CleanupAbandonedCarts')
 * ```
 */
export async function cleanupAbandonedCarts(
  options: CleanupAbandonedCartsOptions = {},
): Promise<CleanupAbandonedCartsResult> {
  const olderThanDays = options.olderThanDays ?? 30
  const limit = options.limit ?? 1000

  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
  const cutoffAt = cutoff.toISOString().slice(0, 19).replace('T', ' ')

  // The pattern below uses a sub-select to apply the LIMIT because
  // most SQL drivers don't accept LIMIT on DELETE directly. SQLite
  // and MySQL both accept the DELETE-from-subselect form; PG needs
  // a CTE-style alternative. Fall back via try/catch so the helper
  // works across drivers without driver-detect plumbing.
  try {
    const result: any = await (db as any)
      .deleteFrom('carts')
      .where('updated_at', '<', cutoffAt)
      .where('id', 'in', (eb: any) =>
        eb.selectFrom('carts')
          .select('id')
          .where('updated_at', '<', cutoffAt)
          .limit(limit),
      )
      .execute()
    const deleted = Number(
      result?.numDeletedRows
      ?? result?.[0]?.numDeletedRows
      ?? result?.affectedRows
      ?? 0,
    )
    return { deleted, cutoffAt }
  }
  catch {
    // Fallback: select-then-delete by id. Slower but driver-portable.
    try {
      const rows = await (db as any)
        .selectFrom('carts')
        .where('updated_at', '<', cutoffAt)
        .select(['id'])
        .limit(limit)
        .execute() as Array<{ id: number }>
      if (rows.length === 0) return { deleted: 0, cutoffAt }
      const ids = rows.map(r => r.id)
      const result: any = await (db as any)
        .deleteFrom('carts')
        .where('id', 'in', ids)
        .execute()
      const deleted = Number(
        result?.numDeletedRows
        ?? result?.[0]?.numDeletedRows
        ?? result?.affectedRows
        ?? rows.length,
      )
      return { deleted, cutoffAt }
    }
    catch {
      return { deleted: 0, cutoffAt }
    }
  }
}
