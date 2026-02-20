type WaitlistRestaurantJsonResponse = ModelRow<typeof WaitlistRestaurant>
type NewWaitlistRestaurant = NewModelData<typeof WaitlistRestaurant>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Create a new restaurant waitlist entry
 *
 * @param data Restaurant waitlist data to store
 * @returns The newly created restaurant waitlist record
 */
export async function store(data: NewWaitlistRestaurant): Promise<WaitlistRestaurantJsonResponse> {
  try {
    const waitlistData = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      party_size: data.party_size,
      check_in_time: typeof data.check_in_time === 'number' ? formatDate(data.check_in_time) : data.check_in_time,
      table_preference: data.table_preference,
      status: data.status || 'waiting',
      quoted_wait_time: data.quoted_wait_time,
      actual_wait_time: data.actual_wait_time,
      queue_position: data.queue_position,
      customer_id: data.customer_id,
      uuid: randomUUIDv7(),
    }

    // Filter out undefined values to avoid storing explicit nulls
    const filteredData: Record<string, any> = {}
    for (const [key, value] of Object.entries(waitlistData)) {
      if (value !== undefined) {
        filteredData[key] = value
      }
    }

    const result = await db
      .insertInto('waitlist_restaurants')
      .values(filteredData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create restaurant waitlist entry')

    // Convert null values to undefined for nullable fields
    const cleaned: any = { ...result }
    for (const key of Object.keys(cleaned)) {
      if (cleaned[key] === null)
        cleaned[key] = undefined
    }

    return cleaned as WaitlistRestaurantJsonResponse
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
      name: item.name,
      email: item.email,
      phone: item.phone,
      party_size: item.party_size,
      check_in_time: typeof item.check_in_time === 'number' ? formatDate(item.check_in_time) : item.check_in_time,
      table_preference: item.table_preference,
      status: item.status || 'waiting',
      quoted_wait_time: item.quoted_wait_time,
      actual_wait_time: item.actual_wait_time,
      queue_position: item.queue_position,
      customer_id: item.customer_id,
      uuid: randomUUIDv7(),
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
