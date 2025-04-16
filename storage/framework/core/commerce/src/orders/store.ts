// Import dependencies
import type { NewOrder, OrderJsonResponse } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Create a new order
 *
 * @param data The order data to store
 * @returns The newly created order record
 */
export async function store(data: NewOrder): Promise<OrderJsonResponse | undefined> {
  const orderData: NewOrder = {
    ...data,
    status: data.status || 'PENDING',
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
