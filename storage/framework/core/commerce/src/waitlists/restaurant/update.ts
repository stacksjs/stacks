import type { ModelRow, UpdateModelData, WaitlistRestaurant } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { fetchById } from './fetch'
import { restaurantWaitlistWriteData } from './write-data'
type WaitlistRestaurantJsonResponse = ModelRow<typeof WaitlistRestaurant>
type WaitlistRestaurantUpdate = UpdateModelData<typeof WaitlistRestaurant>

/**
 * Update a restaurant waitlist entry
 *
 * @param id The id of the restaurant waitlist entry to update
 * @param data The restaurant waitlist data to update
 * @returns The updated restaurant waitlist record
 */
export async function update(id: number, data: WaitlistRestaurantUpdate): Promise<WaitlistRestaurantJsonResponse | undefined> {
  try {
    if (!id)
      throw new Error('Restaurant waitlist entry ID is required for update')

    const existing = await fetchById(id)
    if (!existing)
      return undefined

    await db
      .updateTable('waitlist_restaurants')
      .set({
        ...restaurantWaitlistWriteData(
          data as Record<string, unknown>,
          existing as Record<string, unknown>,
        ),
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    const result = await fetchById(id)
    if (!result)
      return undefined

    return result as WaitlistRestaurantJsonResponse
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
  status: 'waiting' | 'seated' | 'cancelled' | 'no_show',
): Promise<WaitlistRestaurantJsonResponse | undefined> {
  return await update(id, { status } as WaitlistRestaurantUpdate)
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
): Promise<WaitlistRestaurantJsonResponse | undefined> {
  return await update(id, { party_size: partySize } as WaitlistRestaurantUpdate)
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
): Promise<WaitlistRestaurantJsonResponse | undefined> {
  return await update(id, {
    quoted_wait_time: quotedWaitTime,
    ...(actualWaitTime === undefined ? {} : { actual_wait_time: actualWaitTime }),
  } as WaitlistRestaurantUpdate)
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
): Promise<WaitlistRestaurantJsonResponse | undefined> {
  return await update(id, { queue_position: queuePosition } as WaitlistRestaurantUpdate)
}
