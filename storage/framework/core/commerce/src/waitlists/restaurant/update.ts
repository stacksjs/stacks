import type { WaitlistRestaurantJsonResponse, WaitlistRestaurantUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Update a restaurant waitlist entry
 *
 * @param id The id of the restaurant waitlist entry to update
 * @param data The restaurant waitlist data to update
 * @returns The updated restaurant waitlist record
 */
export async function update(id: number, data: WaitlistRestaurantUpdate): Promise<WaitlistRestaurantJsonResponse> {
  try {
    if (!id)
      throw new Error('Restaurant waitlist entry ID is required for update')

    const result = await db
      .updateTable('waitlist_restaurants')
      .set({
        name: data.name,
        email: data.email,
        phone: data.phone,
        party_size: data.party_size,
        check_in_time: data.check_in_time ? Math.floor(new Date(data.check_in_time).getTime() / 1000) : undefined,
        table_preference: data.table_preference,
        status: data.status,
        quoted_wait_time: data.quoted_wait_time,
        actual_wait_time: data.actual_wait_time,
        queue_position: data.queue_position,
        customer_id: data.customer_id,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update restaurant waitlist entry')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update restaurant waitlist entry: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update a restaurant waitlist entry's status
 *
 * @param id The ID of the restaurant waitlist entry
 * @param status The new status
 * @returns The updated restaurant waitlist entry with the new status
 */
export async function updateStatus(
  id: number,
  status: 'waiting' | 'seated',
): Promise<WaitlistRestaurantJsonResponse> {
  try {
    const result = await db
      .updateTable('waitlist_restaurants')
      .set({
        status,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update restaurant waitlist entry status')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update restaurant waitlist entry status: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update party size for a restaurant waitlist entry
 *
 * @param id The ID of the restaurant waitlist entry
 * @param partySize The updated party size
 * @returns The updated restaurant waitlist entry
 */
export async function updatePartySize(
  id: number,
  partySize: number,
): Promise<WaitlistRestaurantJsonResponse> {
  try {
    const result = await db
      .updateTable('waitlist_restaurants')
      .set({
        party_size: partySize,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update party size')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update party size: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update wait times for a restaurant waitlist entry
 *
 * @param id The ID of the restaurant waitlist entry
 * @param quotedWaitTime The quoted wait time in minutes
 * @param actualWaitTime The actual wait time in minutes (optional)
 * @returns The updated restaurant waitlist entry
 */
export async function updateWaitTimes(
  id: number,
  quotedWaitTime: number,
  actualWaitTime?: number,
): Promise<WaitlistRestaurantJsonResponse> {
  try {
    const result = await db
      .updateTable('waitlist_restaurants')
      .set({
        quoted_wait_time: quotedWaitTime,
        actual_wait_time: actualWaitTime,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update wait times')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update wait times: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update queue position for a restaurant waitlist entry
 *
 * @param id The ID of the restaurant waitlist entry
 * @param queuePosition The updated queue position
 * @returns The updated restaurant waitlist entry
 */
export async function updateQueuePosition(
  id: number,
  queuePosition: number,
): Promise<WaitlistRestaurantJsonResponse> {
  try {
    const result = await db
      .updateTable('waitlist_restaurants')
      .set({
        queue_position: queuePosition,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update queue position')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update queue position: ${error.message}`)
    }

    throw error
  }
}
