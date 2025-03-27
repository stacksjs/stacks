import type { CouponJsonResponse, CouponRequestType, NewCoupon } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new coupon
 *
 * @param request The coupon data to store
 * @returns The newly created coupon record
 */
export async function store(request: CouponRequestType): Promise<CouponJsonResponse | undefined> {
  await request.validate()

  const couponData: NewCoupon = {
    code: request.get('code'),
    description: request.get('description'),
    discount_type: request.get('discount_type'),
    discount_value: request.get<number>('discount_value'),
    product_id: request.get<number>('product_id'),
    min_order_amount: request.get<number | undefined>('min_order_amount'),
    max_discount_amount: request.get<number | undefined>('max_discount_amount'),
    free_product_id: request.get('free_product_id'),
    is_active: request.get<boolean>('is_active'),
    usage_limit: request.get<number | undefined>('usage_limit'),
    usage_count: request.get<number>('usage_count'),
    start_date: request.get('start_date'),
    end_date: request.get('end_date'),
    applicable_products: request.get<string[] | undefined>('applicable_products')
      ? JSON.stringify(request.get<string[]>('applicable_products'))
      : JSON.stringify([]),
    applicable_categories: request.get<string[] | undefined>('applicable_categories')
      ? JSON.stringify(request.get<string[]>('applicable_categories'))
      : JSON.stringify([]),
  }

  couponData.uuid = randomUUIDv7()

  try {
    // Insert the coupon record
    const createdCoupon = await db
      .insertInto('coupons')
      .values(couponData)
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
