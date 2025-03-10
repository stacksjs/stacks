// Import dependencies
import type { OrderRequestType } from '@stacksjs/orm'
import type { OrderType } from '../../types'
import { db } from '@stacksjs/database'
import { fetchById } from './fetch'

/**
 * Update an order by ID
 *
 * @param id The ID of the order to update
 * @param request The updated order data
 * @returns The updated order record
 */
export async function update(id: number, request: OrderRequestType): Promise<OrderType | undefined> {
  // Validate the request data
  await request.validate()

  // Check if order exists
  const existingOrder = await fetchById(id)
  if (!existingOrder) {
    throw new Error(`Order with ID ${id} not found`)
  }

  // Create update data object using request fields
  const updateData: Record<string, any> = {
    customer_id: request.get<number>('customer_id'),
    coupon_id: request.get<number>('coupon_id'),
    status: request.get('status'),
    total_amount: request.get<number>('total_amount'),
    tax_amount: request.get<number>('tax_amount'),
    discount_amount: request.get<number>('discount_amount'),
    delivery_fee: request.get<number>('delivery_fee'),
    tip_amount: request.get<number>('tip_amount'),
    order_type: request.get('order_type'),
    delivery_address: request.get('delivery_address'),
    special_instructions: request.get('special_instructions'),
    estimated_delivery_time: request.get('estimated_delivery_time'),
    applied_coupon_id: request.get<number>('applied_coupon_id'),
    updated_at: new Date(),
  }

  // Remove undefined fields to avoid overwriting with null values
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] === undefined) {
      delete updateData[key]
    }
  })

  // If no fields to update, just return the existing order
  if (Object.keys(updateData).length === 0) {
    return existingOrder
  }

  try {
    // Update the order
    await db
      .updateTable('orders')
      .set(updateData)
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
): Promise<OrderType | undefined> {
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
        updated_at: new Date(),
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
): Promise<OrderType | undefined> {
  // Check if order exists
  const order = await fetchById(id)

  if (!order) {
    throw new Error(`Order with ID ${id} not found`)
  }

  // Create update data with only provided fields
  const updateData: Record<string, any> = {
    updated_at: new Date(),
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
