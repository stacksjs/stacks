import type { OrderJsonResponse, OrderUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
// Import dependencies
import { formatDate } from '@stacksjs/orm'
import { fetchById } from './fetch'

/**
 * Update an order by ID
 *
 * @param id The ID of the order to update
 * @param data The updated order data
 * @returns The updated order record
 */
export async function update(id: number, data: Omit<OrderUpdate, 'id'>): Promise<OrderJsonResponse | undefined> {
  // Check if order exists
  const existingOrder = await fetchById(id)
  if (!existingOrder) {
    throw new Error(`Order with ID ${id} not found`)
  }

  try {
    // Update the order
    await db
      .updateTable('orders')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    // Fetch and return the updated order
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update order: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update an order's status
 *
 * @param id The ID of the order
 * @param status The new order status
 * @returns The updated order with the new status
 */
export async function updateStatus(
  id: number,
  status: 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED',
): Promise<OrderJsonResponse | undefined> {
  // Check if order exists
  const order = await fetchById(id)

  if (!order) {
    throw new Error(`Order with ID ${id} not found`)
  }

  try {
    // Update the order status
    await db
      .updateTable('orders')
      .set({
        status,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated order
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update order status: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update delivery information for an order
 *
 * @param id The ID of the order
 * @param delivery_address The updated delivery address
 * @param estimated_delivery_time The updated estimated delivery time
 * @returns The updated order
 */
export async function updateDeliveryInfo(
  id: number,
  delivery_address?: string,
  estimated_delivery_time?: string,
): Promise<OrderJsonResponse | undefined> {
  // Check if order exists
  const order = await fetchById(id)

  if (!order) {
    throw new Error(`Order with ID ${id} not found`)
  }

  // Create update data with only provided fields
  const updateData: Record<string, any> = {
    updated_at: formatDate(new Date()),
  }

  if (delivery_address !== undefined) {
    updateData.delivery_address = delivery_address
  }

  if (estimated_delivery_time !== undefined) {
    updateData.estimated_delivery_time = estimated_delivery_time
  }

  // If no delivery fields to update, just return the existing order
  if (Object.keys(updateData).length === 1) { // Only updated_at was set
    return order
  }

  try {
    // Update the order
    await db
      .updateTable('orders')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch the updated order
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update delivery information: ${error.message}`)
    }

    throw error
  }
}
