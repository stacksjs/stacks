import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { mutationCount } from '../utils/mutation-count'

/**
 * Delete a coupon by ID
 * @param id The ID of the coupon to delete
 * @returns A boolean indicating success
 */
export async function deleteCoupon(id: number): Promise<boolean> {
  const result = await db
    .deleteFrom('coupons')
    .where('id', '=', id)
    .executeTakeFirst()

  return mutationCount(result) > 0
}

/**
 * Delete multiple coupons by IDs
 * @param ids Array of coupon IDs to delete
 * @returns Number of deleted coupons
 */
export async function deleteCoupons(ids: number[]): Promise<number> {
  if (!ids.length) {
    return 0
  }

  const result = await db
    .deleteFrom('coupons')
    .where('id', 'in', ids)
    .execute()

  // `execute()` on a delete answers the affected-row count. Reading
  // `.length` off a number is `undefined`, so `|| 0` made this report 0
  // deleted every time, however many rows went.
  return result || 0
}

/**
 * Delete expired coupons
 * @returns The number of deleted coupons
 */
export async function deleteExpiredCoupons(): Promise<number> {
  const currentDate = formatDate(new Date())

  const result = await db
    .deleteFrom('coupons')
    .where('end_date', '<', currentDate)
    .executeTakeFirst()

  return mutationCount(result)
}
