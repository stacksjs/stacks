import type { WaitlistRestaurantJsonResponse, WaitlistRestaurantRequestType } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new restaurant waitlist entry
 *
 * @param request Restaurant waitlist data to store
 * @returns The newly created restaurant waitlist record
 */
export async function store(request: WaitlistRestaurantRequestType): Promise<WaitlistRestaurantJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare restaurant waitlist data
    const waitlistData = {
      name: request.get('name'),
      email: request.get('email'),
      phone: request.get('phone'),
      party_size: Number(request.get('party_size')),
      check_in_time: request.get('check_in_time'),
      table_preference: request.get('table_preference'),
      status: request.get('status') || 'waiting',
      quoted_wait_time: Number(request.get('quoted_wait_time')),
      actual_wait_time: request.get('actual_wait_time') ? Number(request.get('actual_wait_time')) : undefined,
      queue_position: request.get('queue_position') ? Number(request.get('queue_position')) : undefined,
      customer_id: Number(request.get('customer_id')),
      uuid: randomUUIDv7(),
    }

    // Insert the restaurant waitlist entry
    const result = await db
      .insertInto('wait_list_restaurants')
      .values(waitlistData)
      .executeTakeFirst()

    const waitlistId = Number(result.insertId) || Number(result.numInsertedOrUpdatedRows)

    // Retrieve the newly created restaurant waitlist entry
    const waitlistEntry = await db
      .selectFrom('wait_list_restaurants')
      .where('id', '=', waitlistId)
      .selectAll()
      .executeTakeFirst()

    return waitlistEntry
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create restaurant waitlist entry: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple restaurant waitlist entries at once
 *
 * @param requests Array of restaurant waitlist data to store
 * @returns Number of restaurant waitlist entries created
 */
export async function bulkStore(requests: WaitlistRestaurantRequestType[]): Promise<number> {
  if (!requests.length)
    return 0

  let createdCount = 0

  try {
    // Process each restaurant waitlist entry
    await db.transaction().execute(async (trx) => {
      for (const request of requests) {
        // Validate request data
        request.validate()

        // Prepare restaurant waitlist data
        const waitlistData = {
          name: request.get('name'),
          email: request.get('email'),
          phone: request.get('phone'),
          party_size: Number(request.get('party_size')),
          check_in_time: request.get('check_in_time'),
          table_preference: request.get('table_preference'),
          status: request.get('status') || 'waiting',
          quoted_wait_time: Number(request.get('quoted_wait_time')),
          actual_wait_time: request.get('actual_wait_time') ? Number(request.get('actual_wait_time')) : undefined,
          queue_position: request.get('queue_position') ? Number(request.get('queue_position')) : undefined,
          customer_id: Number(request.get('customer_id')),
          uuid: randomUUIDv7(),
        }

        // Insert the restaurant waitlist entry
        await trx
          .insertInto('wait_list_restaurants')
          .values(waitlistData)
          .execute()

        createdCount++
      }
    })

    return createdCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create restaurant waitlist entries in bulk: ${error.message}`)
    }

    throw error
  }
}
