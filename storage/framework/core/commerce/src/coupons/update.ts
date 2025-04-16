import type { CouponJsonResponse, CouponUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { fetchById } from './fetch'

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
