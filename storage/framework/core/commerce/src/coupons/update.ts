import { db } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { formatDate, isUniqueViolation } from '@stacksjs/orm'
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

    // Fetch and return the updated coupon. `fetchById` already runs
    // `processCouponData`, which coerces `isActive` to a real boolean.
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof HttpError)
      throw error
    // Cross-dialect duplicate detection (#1957).
    if (isUniqueViolation(error))
      throw new HttpError(409, 'A coupon with this code already exists')
    if (error instanceof Error)
      throw new Error(`Failed to update coupon: ${error.message}`)
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
  //
  // Issued via `db.unsafe` with bound parameters: the fluent update
  // builder can neither render raw SET expressions (`usage_count + 1`)
  // nor OR-grouped WHERE predicates, and its where-callback form is
  // silently dropped by the runtime — which would drop the max_uses
  // guard entirely. One parameterized statement keeps the whole
  // precondition set atomic and injection-safe.
  const now = formatDate(new Date())
  const statement = await (db as any).unsafe(
    `UPDATE coupons
    SET usage_count = COALESCE(usage_count, 0) + 1, updated_at = ?
    WHERE id = ?
      AND (max_uses IS NULL OR usage_count < max_uses)
      AND is_active = 1
      AND (start_date IS NULL OR start_date <= ?)
      AND (end_date IS NULL OR end_date >= ?)`,
    [now, id, now, now],
  )
  const result = typeof statement?.execute === 'function' ? await statement.execute() : statement

  // If the UPDATE matched zero rows, the redemption failed
  // (precondition mismatch); diagnose which one to give the caller a
  // useful reason.
  const affected = Number(result?.changes ?? result?.numUpdatedRows ?? result?.affectedRows ?? 0)
  if (affected > 0) {
    const refreshed = await fetchById(id)
    if (refreshed)
      return { ok: true, coupon: refreshed }
    return { ok: false, reason: 'not-found' }
  }

  // UPDATE matched zero rows — figure out which precondition failed.
  // `fetchById` rows are camelCase (`isActive` / `startDate` / `endDate`)
  // with `isActive` already coerced to boolean by `processCouponData`.
  const existing = await fetchById(id)
  if (!existing) return { ok: false, reason: 'not-found' }
  if (!existing.isActive) return { ok: false, reason: 'inactive' }
  const startOk = !existing.startDate || existing.startDate <= now
  const endOk = !existing.endDate || existing.endDate >= now
  if (!startOk || !endOk) return { ok: false, reason: 'expired' }
  // Fell through every other check → limit must have been reached.
  return { ok: false, reason: 'limit-reached' }
}
