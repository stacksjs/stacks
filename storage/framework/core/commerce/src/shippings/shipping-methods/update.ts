import type { ShippingMethodJsonResponse, ShippingMethodUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Update a shipping method
 *
 * @param id The ID of the shipping method
 * @param data The shipping method data to update
 * @returns The updated shipping method record
 */
export async function update(id: number, data: ShippingMethodUpdate): Promise<ShippingMethodJsonResponse> {
  try {
    if (!id)
      throw new Error('Shipping method ID is required for update')

    const result = await db
      .updateTable('shipping_methods')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update shipping method')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update shipping method: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update a shipping method's status
 *
 * @param id The ID of the shipping method
 * @param status The new status
 * @returns The updated shipping method with the new status
 */
export async function updateStatus(
  id: number,
  status: string | string[],
): Promise<ShippingMethodJsonResponse> {
  try {
    const result = await db
      .updateTable('shipping_methods')
      .set({
        status,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update shipping method status')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update shipping method status: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update pricing information for a shipping method
 *
 * @param id The ID of the shipping method
 * @param base_rate Optional updated base rate
 * @param free_shipping Optional updated free shipping threshold
 * @returns The updated shipping method
 */
export async function updatePricing(
  id: number,
  base_rate?: number,
  free_shipping?: number,
): Promise<ShippingMethodJsonResponse> {
  try {
    const updateData: Record<string, any> = {
      updated_at: formatDate(new Date()),
    }

    if (base_rate !== undefined)
      updateData.base_rate = base_rate
    if (free_shipping !== undefined)
      updateData.free_shipping = free_shipping

    const result = await db
      .updateTable('shipping_methods')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update pricing information')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update pricing information: ${error.message}`)
    }

    throw error
  }
}
