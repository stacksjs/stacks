import type { NewWaitlistProduct, WaitlistProductJsonResponse } from '@stacksjs/orm'
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
      ...data,
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

    return result
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
      ...item,
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
