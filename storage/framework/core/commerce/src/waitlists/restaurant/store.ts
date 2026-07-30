type WaitlistRestaurantJsonResponse = ModelRow<typeof WaitlistRestaurant>
type NewWaitlistRestaurant = NewModelData<typeof WaitlistRestaurant>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { mutationCount } from '../../utils/mutation-count'
import { restaurantWaitlistWriteData } from './write-data'

/**
 * Create a new restaurant waitlist entry
 *
 * @param data Restaurant waitlist data to store
 * @returns The newly created restaurant waitlist record
 */
export async function store(data: NewWaitlistRestaurant): Promise<WaitlistRestaurantJsonResponse> {
  try {
    const uuid = randomUUIDv7()
    const waitlistData = {
      ...restaurantWaitlistWriteData(data as Record<string, unknown>),
      status: data.status || 'waiting',
      uuid,
    }

    await db
      .insertInto('waitlist_restaurants')
      .values(waitlistData)
      .executeTakeFirst()

    const result = await db
      .selectFrom('waitlist_restaurants')
      .where('uuid', '=', uuid)
      .selectAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create restaurant waitlist entry')

    return result as WaitlistRestaurantJsonResponse
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
      ...restaurantWaitlistWriteData(item as Record<string, unknown>),
      status: item.status || 'waiting',
      uuid: randomUUIDv7(),
    }))

    const result = await db
      .insertInto('waitlist_restaurants')
      .values(waitlistDataArray)
      .executeTakeFirst()

    return mutationCount(result)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create restaurant waitlist entries in bulk: ${error.message}`)
    }

    throw error
  }
}
