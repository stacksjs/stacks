type CouponJsonResponse = ModelRow<typeof Coupon>
type NewCoupon = NewModelData<typeof Coupon>
import { db } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { isUniqueViolation } from '@stacksjs/orm'

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

      return coupon as CouponJsonResponse
    }

    return undefined
  }
  catch (error) {
    if (error instanceof HttpError)
      throw error
    // Cross-dialect duplicate detection (#1957) — replaces the MySQL-only
    // 'Duplicate entry' sniff so SQLite/Postgres duplicates also map to 409.
    if (isUniqueViolation(error))
      throw new HttpError(409, 'A coupon with this code already exists')
    if (error instanceof Error)
      throw new Error(`Failed to create coupon: ${error.message}`)
    throw error
  }
}
