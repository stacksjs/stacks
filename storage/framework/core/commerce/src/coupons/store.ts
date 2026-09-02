import type { Coupon, ModelRow, NewModelData } from '@stacksjs/orm'
type CouponJsonResponse = ModelRow<typeof Coupon>
type NewCoupon = NewModelData<typeof Coupon>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { asModelRow } from '../utils/model-row'
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
    const uuid = randomUUIDv7()
    await db
      .insertInto('coupons')
      .values({
        ...data,
        uuid,
      })
      .executeTakeFirst()

    const coupon = await db
      .selectFrom('coupons')
      .where('uuid', '=', uuid)
      .selectAll()
      .executeTakeFirst()

    return asModelRow<CouponJsonResponse>(coupon, true)
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
