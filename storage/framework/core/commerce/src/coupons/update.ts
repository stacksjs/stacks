import type { StacksExpressionBuilder } from '@stacksjs/database'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
type CouponJsonResponse = ModelRow<typeof Coupon>
type CouponUpdate = UpdateModelData<typeof Coupon>
import { fetchById } from './fetch'

/**
 * Discriminated result for `redeem` — `ok: true` on a successful
 * atomic redemption (the row's `usage_count` was bumped and the
 * limit wasn't already hit); `ok: false` with a `reason` when the
 * redemption failed (out of uses, expired, inactive, missing).
 * Callers branch on `reason` to surface a useful error to the user.
 */
export type CouponRedemptionResult =
  | { ok: true, coupon: CouponJsonResponse }
  | { ok: false, reason: 'not-found' | 'inactive' | 'expired' | 'limit-reached' }

/**
 * Update a coupon by ID
 *
 * @param id The ID of the coupon to update
 * @param data The updated coupon data
 * @returns The updated coupon record
 */
export async function update(id: number, data: Omit<CouponUpdate, 'id'>): Promise<CouponJsonResponse | undefined> {
  // Check if coupon exists
  const existingCoupon = await fetchById(id)
  if (!existingCoupon) {
    throw new Error(`Coupon with ID ${id} not found`)
  }

  try {
    // Update the coupon
    await db
      .updateTable('coupons')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    // Fetch and return the updated coupon
    const updatedCoupon = await fetchById(id)

    if (updatedCoupon) {
      // Convert SQLite integer boolean to actual boolean
      const c = updatedCoupon as Record<string, unknown>
      c.is_active = Boolean(c.is_active)
    }

    return updatedCoupon
  }
  catch (error) {
    if (error instanceof Error) {
      // Handle duplicate code error
      if (error.message.includes('Duplicate entry') && error.message.includes('code')) {
        throw new Error('A coupon with this code already exists')
      }

      throw new Error(`Failed to update coupon: ${error.message}`)
    }

    throw error
  }
}

/**
 * Atomically redeem a coupon (stacksjs/stacks#1879 Co-5).
 *
 * Pre-fix: callers fetched the coupon, checked `usage_count <
 * max_uses`, then bumped `usage_count` via `update()`. Two concurrent
 * redemption requests against a coupon with `max_uses=1` both saw
 * `usage_count=0`, both incremented, both succeeded. The coupon
 * was redeemed twice — direct revenue loss equal to `discount_value`
 * times the over-redemption count.
 *
 * Post-fix: single conditional UPDATE that bumps `usage_count` and
 * enforces `max_uses` / `is_active` / expiry in the WHERE clause.
 * The database guarantees only one writer wins the race. Returns a
 * discriminated result so callers can surface a useful reason
 * ("limit reached" vs "expired" vs "inactive") instead of a generic
 * failure.
 *
 * @example
 * ```ts
 * const result = await redeem(couponId)
 * if (!result.ok) {
 *   throw new HttpError(400, `Coupon cannot be redeemed: ${result.reason}`)
 * }
 * // Use result.coupon — it reflects the post-redemption state.
 * ```
 */
export async function redeem(id: number): Promise<CouponRedemptionResult> {
  // Single atomic UPDATE — increment usage_count and enforce every
  // redemption precondition in the WHERE clause. `max_uses IS NULL`
  // means "unlimited" so coupons without an explicit cap aren't
  // accidentally rejected.
  const now = formatDate(new Date())
  const result = await db
    .updateTable('coupons')
    .set({
      usage_count: (db as any).raw(`COALESCE(usage_count, 0) + 1`),
      updated_at: now,
    })
    .where('id', '=', id)
    .where((eb: StacksExpressionBuilder) => eb.or([
      eb('max_uses', 'is', null),
      eb.cmpr('usage_count', '<', eb.ref('max_uses')),
    ]))
    .where('is_active', '=', 1)
    .where((eb: StacksExpressionBuilder) => eb.or([
      eb('start_date', 'is', null),
      eb.cmpr('start_date', '<=', now),
    ]))
    .where((eb: StacksExpressionBuilder) => eb.or([
      eb('end_date', 'is', null),
      eb.cmpr('end_date', '>=', now),
    ]))
    .executeTakeFirst()

  // bun-query-builder's executeTakeFirst returns metadata describing
  // affected rows. If the UPDATE matched zero rows, the redemption
  // failed (precondition mismatch); diagnose which one to give the
  // caller a useful reason.
  const affected = Number((result as any)?.numUpdatedRows ?? (result as any)?.affectedRows ?? 0)
  if (affected > 0) {
    const refreshed = await fetchById(id)
    if (refreshed) {
      // Convert SQLite integer boolean to actual boolean.
      const c = refreshed as Record<string, unknown>
      c.is_active = Boolean(c.is_active)
      return { ok: true, coupon: refreshed }
    }
    return { ok: false, reason: 'not-found' }
  }

  // UPDATE matched zero rows — figure out which precondition failed.
  const existing = await fetchById(id)
  if (!existing) return { ok: false, reason: 'not-found' }
  if (!existing.is_active) return { ok: false, reason: 'inactive' }
  const startOk = !existing.start_date || existing.start_date <= now
  const endOk = !existing.end_date || existing.end_date >= now
  if (!startOk || !endOk) return { ok: false, reason: 'expired' }
  // Fell through every other check → limit must have been reached.
  return { ok: false, reason: 'limit-reached' }
}
