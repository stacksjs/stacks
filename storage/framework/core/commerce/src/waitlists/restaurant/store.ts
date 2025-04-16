import type { NewWaitlistRestaurant, WaitlistRestaurantJsonResponse } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new restaurant waitlist entry
 *
 * @param data Restaurant waitlist data to store
 * @returns The newly created restaurant waitlist record
 */
export async function store(data: NewWaitlistRestaurant): Promise<WaitlistRestaurantJsonResponse> {
  try {
    const waitlistData = {
      ...data,
      uuid: randomUUIDv7(),
      status: data.status || 'waiting',
      check_in_time: data.check_in_time ? Math.floor(new Date(data.check_in_time).getTime() / 1000) : undefined,
    }

    const result = await db
      .insertInto('waitlist_restaurants')
      .values(waitlistData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create restaurant waitlist entry')

    return result
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
 * @param data Array of restaurant waitlist data to store
 * @returns Number of restaurant waitlist entries created
 */
export async function bulkStore(data: NewWaitlistRestaurant[]): Promise<number> {
  if (!data.length)
    return 0

  try {
    const waitlistDataArray = data.map(item => ({
      ...item,
      uuid: randomUUIDv7(),
      status: item.status || 'waiting',
      check_in_time: item.check_in_time ? Math.floor(new Date(item.check_in_time).getTime() / 1000) : undefined,
    }))

    const result = await db
      .insertInto('waitlist_restaurants')
      .values(waitlistDataArray)
      .executeTakeFirst()

    return Number(result.numInsertedOrUpdatedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create restaurant waitlist entries in bulk: ${error.message}`)
    }

    throw error
  }
}
