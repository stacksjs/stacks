import type { CouponJsonResponse, NewCoupon } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Create a new coupon
 *
 * @param data The coupon data to store
 * @returns The newly created coupon record
 */
export async function store(data: NewCoupon): Promise<CouponJsonResponse | undefined> {
  try {
    // Insert the coupon record
    const createdCoupon = await db
      .insertInto('coupons')
      .values(data)
      .executeTakeFirst()

    const couponId = Number(createdCoupon.insertId) || Number(createdCoupon.numInsertedOrUpdatedRows)

    if (couponId) {
      const coupon = await db
        .selectFrom('coupons')
        .where('id', '=', couponId)
        .selectAll()
        .executeTakeFirst()

      return coupon
    }

    return undefined
  }
  catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Duplicate entry') && error.message.includes('code')) {
        throw new Error('A coupon with this code already exists')
      }

      throw new Error(`Failed to create coupon: ${error.message}`)
    }

    throw error
  }
}
