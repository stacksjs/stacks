import type { WaitlistProductJsonResponse, WaitlistProductRequestType } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new waitlist product entry
 *
 * @param request Waitlist product data to store
 * @returns The newly created waitlist product record
 */
export async function store(request: WaitlistProductRequestType): Promise<WaitlistProductJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare waitlist product data
    const waitlistData = {
      name: request.get('name'),
      email: request.get('email'),
      phone: request.get('phone'),
      party_size: Number(request.get('party_size')),
      notification_preference: request.get('notification_preference'),
      source: request.get('source'),
      notes: request.get('notes'),
      status: request.get('status') || 'waiting',
      product_id: Number(request.get('product_id')),
      customer_id: Number(request.get('customer_id')),
      uuid: randomUUIDv7(),
    }

    // Insert the waitlist product
    const result = await db
      .insertInto('wait_list_products')
      .values(waitlistData)
      .executeTakeFirst()

    const waitlistId = Number(result.insertId) || Number(result.numInsertedOrUpdatedRows)

    // Retrieve the newly created waitlist product
    const waitlistProduct = await db
      .selectFrom('wait_list_products')
      .where('id', '=', waitlistId)
      .selectAll()
      .executeTakeFirst()

    return waitlistProduct
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
 * @param requests Array of waitlist product data to store
 * @returns Number of waitlist products created
 */
export async function bulkStore(requests: WaitlistProductRequestType[]): Promise<number> {
  if (!requests.length)
    return 0

  let createdCount = 0

  try {
    // Process each waitlist product
    await db.transaction().execute(async (trx) => {
      for (const request of requests) {
        // Validate request data
        request.validate()

        // Prepare waitlist product data
        const waitlistData = {
          name: request.get('name'),
          email: request.get('email'),
          phone: request.get('phone'),
          party_size: Number(request.get('party_size')),
          notification_preference: request.get('notification_preference'),
          source: request.get('source'),
          notes: request.get('notes'),
          status: request.get('status') || 'waiting',
          product_id: Number(request.get('product_id')),
          customer_id: Number(request.get('customer_id')),
          uuid: randomUUIDv7(),
        }

        // Insert the waitlist product
        await trx
          .insertInto('wait_list_products')
          .values(waitlistData)
          .execute()

        createdCount++
      }
    })

    return createdCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create waitlist products in bulk: ${error.message}`)
    }

    throw error
  }
}
