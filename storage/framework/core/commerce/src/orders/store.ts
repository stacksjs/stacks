// Import dependencies
import type { OrderRequestType } from '@stacksjs/orm'
import type { NewOrder, OrderItemForCalculation, OrderTotals, OrderType } from '../../types'
import { db } from '@stacksjs/database'

/**
 * Create a new order
 *
 * @param request Order data to store
 * @returns The newly created order record
 */
export async function store(request: OrderRequestType): Promise<OrderType | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare order data
    const orderData = {
      customer_id: request.get<number>('customer_id'),
      coupon_id: request.get<number>('coupon_id'),
      status: request.get('status', 'PENDING'),
      total_amount: request.get<number>('total_amount', 0),
      tax_amount: request.get<number>('tax_amount'),
      discount_amount: request.get<number>('discount_amount', 0),
      delivery_fee: request.get<number>('delivery_fee', 0),
      tip_amount: request.get<number>('tip_amount', 0),
      order_type: request.get('order_type'),
      delivery_address: request.get('delivery_address'),
      special_instructions: request.get('special_instructions'),
      estimated_delivery_time: request.get('estimated_delivery_time'),
      applied_coupon_id: request.get('applied_coupon_id'),
    }

    // Insert the order
    const result = await db
      .insertInto('orders')
      .values(orderData)
      .executeTakeFirst()

    const orderId = Number(result.insertId)

    // Retrieve the newly created order
    const order = await db
      .selectFrom('orders')
      .where('id', '=', orderId)
      .selectAll()
      .executeTakeFirst()

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
        // Validate request data
        request.validate()

        // Prepare order data
        const orderData: NewOrder = {
          customer_id: request.get('customer_id'),
          coupon_id: request.get('coupon_id'),
          status: request.get('status') || 'PENDING',
          total_amount: request.get('total_amount'),
          tax_amount: request.get('tax_amount'),
          discount_amount: request.get('discount_amount') || 0,
          delivery_fee: request.get('delivery_fee') || 0,
          tip_amount: request.get('tip_amount') || 0,
          order_type: request.get('order_type'),
          delivery_address: request.get('delivery_address'),
          special_instructions: request.get('special_instructions'),
          estimated_delivery_time: request.get('estimated_delivery_time'),
          applied_coupon_id: request.get('applied_coupon_id'),
        }

        await trx
          .insertInto('orders')
          .values(orderData)
          .executeTakeFirst()

        createdCount++

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
 * @param items Array of order items with price and quantity
 * @param taxRate Tax rate as a decimal (e.g., 0.1 for 10%)
 * @returns Calculated order totals including subtotal, tax, and total amount
 */
export function calculateOrderTotals(
  items: OrderItemForCalculation[],
  taxRate: number = 0.1,
): OrderTotals {
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
