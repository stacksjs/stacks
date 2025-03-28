import type { WaitlistProductJsonResponse, WaitlistProductRequestType } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { fetchById } from './fetch'

/**
 * Update a waitlist product by ID
 *
 * @param id The ID of the waitlist product to update
 * @param request The updated waitlist product data
 * @returns The updated waitlist product record
 */
export async function update(id: number, request: WaitlistProductRequestType): Promise<WaitlistProductJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  // Check if waitlist product exists
  const existingProduct = await fetchById(id)

  if (!existingProduct) {
    throw new Error(`Waitlist product with ID ${id} not found`)
  }

  // Create update data object using request fields
  const updateData = {
    name: request.get('name'),
    email: request.get('email'),
    phone: request.get('phone'),
    party_size: Number(request.get('party_size')),
    notification_preference: request.get('notification_preference'),
    source: request.get('source'),
    notes: request.get('notes'),
    status: request.get('status'),
    product_id: Number(request.get('product_id')),
    customer_id: Number(request.get('customer_id')),
    updated_at: formatDate(new Date()),
  }

  // If no fields to update, just return the existing waitlist product
  if (Object.keys(updateData).length === 0) {
    return existingProduct
  }

  try {
    // Update the waitlist product
    await db
      .updateTable('waitlist_products')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch and return the updated waitlist product
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update waitlist product: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update a waitlist product's status
 *
 * @param id The ID of the waitlist product
 * @param status The new status
 * @returns The updated waitlist product with the new status
 */
export async function updateStatus(
  id: number,
  status: 'waiting' | 'purchased' | 'notified' | 'cancelled',
): Promise<WaitlistProductJsonResponse | undefined> {
  // Check if waitlist product exists
  const waitlistProduct = await fetchById(id)

  if (!waitlistProduct) {
    throw new Error(`Waitlist product with ID ${id} not found`)
  }

  try {
    // Update the waitlist product status
    await db
      .updateTable('waitlist_products')
      .set({
        status,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated waitlist product
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update waitlist product status: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update party size for a waitlist product
 *
 * @param id The ID of the waitlist product
 * @param partySize The updated party size
 * @returns The updated waitlist product
 */
export async function updatePartySize(
  id: number,
  partySize: number,
): Promise<WaitlistProductJsonResponse | undefined> {
  // Check if waitlist product exists
  const waitlistProduct = await fetchById(id)

  if (!waitlistProduct) {
    throw new Error(`Waitlist product with ID ${id} not found`)
  }

  try {
    // Update the waitlist product party size
    await db
      .updateTable('waitlist_products')
      .set({
        party_size: partySize,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated waitlist product
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update party size: ${error.message}`)
    }

    throw error
  }
}
