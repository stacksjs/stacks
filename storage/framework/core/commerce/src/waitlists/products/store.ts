type WaitlistProductJsonResponse = ModelRow<typeof WaitlistProduct>
type NewWaitlistProduct = NewModelData<typeof WaitlistProduct>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new waitlist product entry
 *
 * @param data Waitlist product data to store
 * @returns The newly created waitlist product record
 */
export async function store(data: NewWaitlistProduct): Promise<WaitlistProductJsonResponse> {
  try {
    const waitlistData = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      quantity: data.quantity,
      notification_preference: data.notification_preference,
      source: data.source,
      notes: data.notes,
      product_id: data.product_id,
      customer_id: data.customer_id,
      uuid: randomUUIDv7(),
      status: data.status || 'waiting',
    }

    const result = await db
      .insertInto('waitlist_products')
      .values(waitlistData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create waitlist product')

    return result as WaitlistProductJsonResponse
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create waitlist product: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple waitlist product entries at once
 *
 * @param data Array of waitlist product data to store
 * @returns Number of waitlist products created
 */
export async function bulkStore(data: NewWaitlistProduct[]): Promise<number> {
  if (!data.length)
    return 0

  try {
    const waitlistDataArray = data.map(item => ({
      name: item.name,
      email: item.email,
      phone: item.phone,
      quantity: item.quantity,
      notification_preference: item.notification_preference,
      source: item.source,
      notes: item.notes,
      product_id: item.product_id,
      customer_id: item.customer_id,
      uuid: randomUUIDv7(),
      status: item.status || 'waiting',
    }))

    const result = await db
      .insertInto('waitlist_products')
      .values(waitlistDataArray)
      .executeTakeFirst()

    return Number(result.numInsertedOrUpdatedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create waitlist products in bulk: ${error.message}`)
    }

    throw error
  }
}
