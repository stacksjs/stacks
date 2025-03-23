// Import dependencies
import type { ShippingMethodRequestType } from '@stacksjs/orm'
import type { ShippingMethodJsonResponse } from '../../../../orm/src/models/ShippingMethod'
import { db } from '@stacksjs/database'
import { fetchById } from './fetch'

/**
 * Update a shipping method by ID
 *
 * @param id The ID of the shipping method to update
 * @param request The updated shipping method data
 * @returns The updated shipping method record
 */
export async function update(id: number, request: ShippingMethodRequestType): Promise<ShippingMethodJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  // Check if shipping method exists
  const existingMethod = await fetchById(id)

  if (!existingMethod) {
    throw new Error(`Shipping method with ID ${id} not found`)
  }

  // Create update data object using request fields
  const updateData = {
    name: request.get('name'),
    description: request.get('description'),
    base_rate: request.get<number>('base_rate'),
    free_shipping: request.get<number>('free_shipping'),
    status: request.get('status'),
  }

  // If no fields to update, just return the existing shipping method
  if (Object.keys(updateData).length === 0) {
    return existingMethod
  }

  try {
    // Update the shipping method
    await db
      .updateTable('shipping_methods')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch and return the updated shipping method
    return await fetchById(id)
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
): Promise<ShippingMethodJsonResponse | undefined> {
  // Check if shipping method exists
  const shippingMethod = await fetchById(id)

  if (!shippingMethod) {
    throw new Error(`Shipping method with ID ${id} not found`)
  }

  try {
    // Update the shipping method status
    await db
      .updateTable('shipping_methods')
      .set({
        status,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated shipping method
    return await fetchById(id)
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
 * @param base_rate The updated base rate
 * @param free_shipping The updated free shipping threshold
 * @returns The updated shipping method
 */
export async function updatePricing(
  id: number,
  base_rate?: number,
  free_shipping?: number,
): Promise<ShippingMethodJsonResponse | undefined> {
  // Check if shipping method exists
  const shippingMethod = await fetchById(id)

  if (!shippingMethod) {
    throw new Error(`Shipping method with ID ${id} not found`)
  }

  // Create update data with only provided fields
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (base_rate !== undefined) {
    updateData.base_rate = base_rate
  }

  if (free_shipping !== undefined) {
    updateData.free_shipping = free_shipping
  }

  // If no pricing fields to update, just return the existing shipping method
  if (Object.keys(updateData).length === 1) { // Only updated_at was set
    return shippingMethod
  }

  try {
    // Update the shipping method
    await db
      .updateTable('shipping_methods')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch the updated shipping method
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update pricing information: ${error.message}`)
    }

    throw error
  }
}
