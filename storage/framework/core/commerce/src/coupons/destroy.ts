import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

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

  return !!result
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

  return result.length || 0
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

  return Number(result?.numDeletedRows) || 0
}
