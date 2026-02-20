type WaitlistProductJsonResponse = ModelRow<typeof WaitlistProduct>
type NewWaitlistProduct = NewModelData<typeof WaitlistProduct>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Create a new waitlist product entry
 *
 * @param data Waitlist product data to store
 * @returns The newly created waitlist product record
 */
export async function store(data: NewWaitlistProduct): Promise<WaitlistProductJsonResponse> {
  try {
    const waitlistData: Record<string, any> = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      quantity: data.quantity ?? (data as any).party_size,
      notification_preference: data.notification_preference,
      source: data.source,
      notes: data.notes,
      product_id: data.product_id,
      customer_id: data.customer_id,
      uuid: randomUUIDv7(),
      status: data.status || 'waiting',
    }

    if ((data as any).notified_at !== undefined)
      waitlistData.notified_at = typeof (data as any).notified_at === 'number' ? formatDate((data as any).notified_at) : (data as any).notified_at

    if ((data as any).purchased_at !== undefined)
      waitlistData.purchased_at = typeof (data as any).purchased_at === 'number' ? formatDate((data as any).purchased_at) : (data as any).purchased_at

    if ((data as any).cancelled_at !== undefined)
      waitlistData.cancelled_at = typeof (data as any).cancelled_at === 'number' ? formatDate((data as any).cancelled_at) : (data as any).cancelled_at

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
    const waitlistDataArray = data.map((item) => {
      const entry: Record<string, any> = {
        name: item.name,
        email: item.email,
        phone: item.phone,
        quantity: item.quantity ?? (item as any).party_size,
        notification_preference: item.notification_preference,
        source: item.source,
        notes: item.notes,
        product_id: item.product_id,
        customer_id: item.customer_id,
        uuid: randomUUIDv7(),
        status: item.status || 'waiting',
      }

      if ((item as any).notified_at !== undefined)
        entry.notified_at = typeof (item as any).notified_at === 'number' ? formatDate((item as any).notified_at) : (item as any).notified_at

      if ((item as any).purchased_at !== undefined)
        entry.purchased_at = typeof (item as any).purchased_at === 'number' ? formatDate((item as any).purchased_at) : (item as any).purchased_at

      if ((item as any).cancelled_at !== undefined)
        entry.cancelled_at = typeof (item as any).cancelled_at === 'number' ? formatDate((item as any).cancelled_at) : (item as any).cancelled_at

      return entry
    })

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
