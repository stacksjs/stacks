// Import dependencies
import type { NewOrder, OrderJsonResponse, OrderRequestType } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Create a new order
 *
 * @param request The order data to store
 * @returns The newly created order record
 */
export async function store(request: OrderRequestType): Promise<OrderJsonResponse | undefined> {
  await request.validate()

  const orderData: NewOrder = {
    customer_id: request.get<number>('customer_id'),
    coupon_id: request.get<number>('coupon_id'),
    status: request.get('status') || 'PENDING',
    total_amount: request.get<number>('total_amount'),
    tax_amount: request.get<number>('tax_amount'),
    discount_amount: request.get<number>('discount_amount'),
    delivery_fee: request.get<number>('delivery_fee'),
    tip_amount: request.get<number>('tip_amount'),
    order_type: request.get('order_type'),
    delivery_address: request.get('delivery_address'),
    special_instructions: request.get('special_instructions'),
    estimated_delivery_time: request.get('estimated_delivery_time'),
    applied_coupon_id: request.get('applied_coupon_id'),
    uuid: randomUUIDv7(),
    created_at: formatDate(new Date()),
    updated_at: formatDate(new Date()),
  }

  try {
    // Insert the order record
    const createdOrder = await db
      .insertInto('orders')
      .values(orderData)
      .executeTakeFirst()

    const insertId = Number(createdOrder?.insertId) || Number(createdOrder?.numInsertedOrUpdatedRows)

    // If insert was successful, retrieve the newly created order
    if (insertId) {
      const order = await db
        .selectFrom('orders')
        .where('id', '=', insertId)
        .selectAll()
        .executeTakeFirst()

      return order
    }

    return undefined
  }
  catch (error) {
    if (error instanceof Error)
      throw new Error(`Failed to create order: ${error.message}`)

    throw error
  }
}
