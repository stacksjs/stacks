import type { NewOrder, OrderItem, OrderRequestType, OrderType } from '../../types'
import { db } from '@stacksjs/database'
import { handleError } from '@stacksjs/error-handling'
import { v4 as uuidv4 } from 'uuid'

/**
 * Create a new order
 *
 * @param request Order data to store
 * @returns The newly created order record
 */
export async function store(request: OrderRequestType): Promise<OrderType | undefined> {
  try {
    // Generate UUID for the order
    const orderId = uuidv4()

    // Handle order items
    let orderItemsStr: string | undefined
    if (request.order_items) {
      // If order_items is an array, stringify it for storage
      if (Array.isArray(request.order_items)) {
        orderItemsStr = JSON.stringify(request.order_items)
      }
      else {
        // If it's already a string, use it as is
        orderItemsStr = request.order_items
      }
    }

    // Prepare order data
    const orderData: NewOrder = {
      id: orderId,
      customer_id: request.customer_id,
      status: request.status || 'PENDING',
      total_amount: request.total_amount,
      tax_amount: request.tax_amount,
      discount_amount: request.discount_amount || 0,
      delivery_fee: request.delivery_fee || 0,
      tip_amount: request.tip_amount || 0,
      order_type: request.order_type,
      delivery_address: request.delivery_address,
      special_instructions: request.special_instructions,
      estimated_delivery_time: request.estimated_delivery_time,
      applied_coupon_id: request.applied_coupon_id,
      order_items: orderItemsStr,
    }

    // Insert the order
    await db
      .insertInto('orders')
      .values(orderData)
      .execute()

    // Retrieve the newly created order
    const order = await db
      .selectFrom('orders')
      .where('id', '=', orderId)
      .selectAll()
      .executeTakeFirst()

    // Parse order_items JSON if present
    if (order && order.order_items && typeof order.order_items === 'string') {
      try {
        return {
          ...order,
          order_items: JSON.parse(order.order_items),
        }
      }
      catch (e) {
        handleError('Error', e)
        return order
      }
    }

    return order
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create order: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple orders at once
 *
 * @param requests Array of order data to store
 * @returns Number of orders created
 */
export async function bulkStore(requests: OrderRequestType[]): Promise<number> {
  if (!requests.length)
    return 0

  let createdCount = 0

  try {
    // Process each order
    await db.transaction().execute(async (trx) => {
      for (const request of requests) {
        // Validate required fields
        if (!request.customer_id)
          throw new Error('Customer ID is required')
        if (!request.total_amount)
          throw new Error('Total amount is required')
        if (!request.order_type)
          throw new Error('Order type is required')

        // Validate delivery address for DELIVERY orders
        if (request.order_type === 'DELIVERY' && !request.delivery_address) {
          throw new Error('Delivery address is required for delivery orders')
        }

        // Generate UUID for the order
        const orderId = uuidv4()

        // Handle order items
        let orderItemsStr: string | undefined
        if (request.order_items) {
          // If order_items is an array, stringify it for storage
          if (Array.isArray(request.order_items)) {
            orderItemsStr = JSON.stringify(request.order_items)
          }
          else {
            // If it's already a string, use it as is
            orderItemsStr = request.order_items
          }
        }

        // Prepare order data
        const orderData: NewOrder = {
          id: orderId,
          customer_id: request.customer_id,
          status: request.status || 'PENDING',
          total_amount: request.total_amount,
          tax_amount: request.tax_amount,
          discount_amount: request.discount_amount || 0,
          delivery_fee: request.delivery_fee || 0,
          tip_amount: request.tip_amount || 0,
          order_type: request.order_type,
          delivery_address: request.delivery_address,
          special_instructions: request.special_instructions,
          estimated_delivery_time: request.estimated_delivery_time,
          applied_coupon_id: request.applied_coupon_id,
          order_items: orderItemsStr,
        }

        // Insert the order
        await trx
          .insertInto('orders')
          .values(orderData)
          .execute()

        createdCount++
      }
    })

    return createdCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create orders in bulk: ${error.message}`)
    }

    throw error
  }
}

/**
 * Calculate order totals based on items
 *
 * @param items Array of order items
 * @param taxRate Tax rate as a decimal (e.g., 0.1 for 10%)
 * @returns Calculated order totals
 */
export function calculateOrderTotals(items: OrderItem[], taxRate: number = 0.1) {
  // Calculate subtotal from items
  const subtotal = items.reduce((sum, item) => {
    return sum + (item.price * item.quantity)
  }, 0)

  // Calculate tax
  const taxAmount = subtotal * taxRate

  // Return totals
  return {
    subtotal: Number.parseFloat(subtotal.toFixed(2)),
    tax_amount: Number.parseFloat(taxAmount.toFixed(2)),
    total_amount: Number.parseFloat((subtotal + taxAmount).toFixed(2)),
  }
}
