import type { ModelRow, NewModelData, Order } from '@stacksjs/orm'
// Import dependencies
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { insertedId } from '../utils/inserted-id'
type OrderJsonResponse = ModelRow<typeof Order>
type NewOrder = NewModelData<typeof Order>

/**
 * Create a new order
 *
 * @param data The order data to store
 * @returns The newly created order record
 */
export async function store(data: NewOrder): Promise<OrderJsonResponse | undefined> {
  const orderData = {
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
      .values(orderData as NewOrder)
      .executeTakeFirst()

    // Read the id the driver reported, never a row count: SQLite reports
    // `lastInsertRowid` and nothing here read it, so every successful insert
    // returned undefined on the default dialect.
    const id = insertedId(createdOrder)

    if (id !== undefined) {
      const order = await db
        .selectFrom('orders')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst()

      return order as OrderJsonResponse | undefined
    }

    // Postgres reports no insert id without RETURNING; the uuid written above
    // identifies the row on any dialect.
    const order = await db
      .selectFrom('orders')
      .where('uuid', '=', orderData.uuid)
      .selectAll()
      .executeTakeFirst()

    return order as OrderJsonResponse | undefined
  }
  catch (error) {
    if (error instanceof Error)
      throw new Error(`Failed to create order: ${error.message}`)

    throw error
  }
}
