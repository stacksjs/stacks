import type { WaitlistRestaurantJsonResponse, WaitlistRestaurantRequestType } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { fetchById } from './fetch'

/**
 * Update a restaurant waitlist entry by ID
 *
 * @param id The ID of the restaurant waitlist entry to update
 * @param request The updated restaurant waitlist data
 * @returns The updated restaurant waitlist record
 */
export async function update(id: number, request: WaitlistRestaurantRequestType): Promise<WaitlistRestaurantJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  // Check if restaurant waitlist entry exists
  const existingEntry = await fetchById(id)

  if (!existingEntry) {
    throw new Error(`Restaurant waitlist entry with ID ${id} not found`)
  }

  // Create update data object using request fields
  const updateData = {
    name: request.get('name'),
    email: request.get('email'),
    phone: request.get('phone'),
    party_size: Number(request.get('party_size')),
    check_in_time: request.get('check_in_time'),
    table_preference: request.get('table_preference'),
    status: request.get('status'),
    quoted_wait_time: Number(request.get('quoted_wait_time')),
    actual_wait_time: request.get('actual_wait_time') ? Number(request.get('actual_wait_time')) : undefined,
    queue_position: request.get('queue_position') ? Number(request.get('queue_position')) : undefined,
    customer_id: Number(request.get('customer_id')),
    updated_at: formatDate(new Date()),
  }

  // If no fields to update, just return the existing entry
  if (Object.keys(updateData).length === 0) {
    return existingEntry
  }

  try {
    // Update the restaurant waitlist entry
    await db
      .updateTable('wait_list_restaurants')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch and return the updated entry
    return await fetchById(id)
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
): Promise<WaitlistRestaurantJsonResponse | undefined> {
  // Check if restaurant waitlist entry exists
  const waitlistEntry = await fetchById(id)

  if (!waitlistEntry) {
    throw new Error(`Restaurant waitlist entry with ID ${id} not found`)
  }

  try {
    // Update the restaurant waitlist entry status
    await db
      .updateTable('wait_list_restaurants')
      .set({
        status,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated entry
    return await fetchById(id)
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
): Promise<WaitlistRestaurantJsonResponse | undefined> {
  // Check if restaurant waitlist entry exists
  const waitlistEntry = await fetchById(id)

  if (!waitlistEntry) {
    throw new Error(`Restaurant waitlist entry with ID ${id} not found`)
  }

  try {
    // Update the restaurant waitlist entry party size
    await db
      .updateTable('wait_list_restaurants')
      .set({
        party_size: partySize,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated entry
    return await fetchById(id)
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
): Promise<WaitlistRestaurantJsonResponse | undefined> {
  // Check if restaurant waitlist entry exists
  const waitlistEntry = await fetchById(id)

  if (!waitlistEntry) {
    throw new Error(`Restaurant waitlist entry with ID ${id} not found`)
  }

  try {
    // Update the restaurant waitlist entry wait times
    await db
      .updateTable('wait_list_restaurants')
      .set({
        quoted_wait_time: quotedWaitTime,
        actual_wait_time: actualWaitTime ?? undefined,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated entry
    return await fetchById(id)
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
): Promise<WaitlistRestaurantJsonResponse | undefined> {
  // Check if restaurant waitlist entry exists
  const waitlistEntry = await fetchById(id)

  if (!waitlistEntry) {
    throw new Error(`Restaurant waitlist entry with ID ${id} not found`)
  }

  try {
    // Update the restaurant waitlist entry queue position
    await db
      .updateTable('wait_list_restaurants')
      .set({
        queue_position: queuePosition,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated entry
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update queue position: ${error.message}`)
    }

    throw error
  }
}
