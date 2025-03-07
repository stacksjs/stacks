import type { CouponRequestType } from '@stacksjs/orm'
import type { CouponJsonResponse } from '../../../../orm/src/models/Coupon'
import { db } from '@stacksjs/database'
import { fetchById } from './fetch'

/**
 * Update a coupon by ID
 *
 * @param id The ID of the coupon to update
 * @param request The updated coupon data
 * @returns The updated coupon record
 */
export async function update(id: number, request: CouponRequestType): Promise<CouponJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  // Check if coupon exists
  const existingCoupon = await fetchById(id)
  if (!existingCoupon) {
    throw new Error(`Coupon with ID ${id} not found`)
  }

  // Prepare update data object with proper type
  const updateData: Record<string, any> = {
    code: request.get<string>('code'),
    description: request.get<string>('description'),
    discount_type: request.get<string>('discount_type'),
    discount_value: request.get<number>('discount_value'),
    product_id: request.get<number>('product_id'),
    min_order_amount: request.get<number>('min_order_amount'),
    max_discount_amount: request.get<number>('max_discount_amount'),
    free_product_id: request.get<string>('free_product_id'),
    is_active: request.get<boolean>('is_active'),
    usage_limit: request.get<number>('usage_limit'),
    start_date: request.get<string>('start_date'),
    end_date: request.get<string>('end_date'),
    updated_at: new Date(),
  }

  // Process arrays to JSON strings if provided
  if (request.has('applicable_products')) {
    updateData.applicable_products = JSON.stringify(request.get<string[]>('applicable_products'))
  }

  if (request.has('applicable_categories')) {
    updateData.applicable_categories = JSON.stringify(request.get<string[]>('applicable_categories'))
  }

  // Remove undefined fields to avoid overwriting with null values
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] === undefined) {
      delete updateData[key]
    }
  })

  // If no fields to update, just return the existing coupon
  if (Object.keys(updateData).length === 0) {
    return existingCoupon
  }

  try {
    // Update the coupon
    await db
      .updateTable('coupons')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch and return the updated coupon
    return await fetchById(id)
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
