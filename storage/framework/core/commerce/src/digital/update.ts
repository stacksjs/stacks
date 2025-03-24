// Import dependencies
import type { DigitalDeliveryRequestType } from '@stacksjs/orm'
import type { DigitalDeliveryJsonResponse } from '../../../../orm/src/models/DigitalDelivery'
import { db } from '@stacksjs/database'
import { fetchById } from './fetch'

/**
 * Update a digital delivery by ID
 *
 * @param id The ID of the digital delivery to update
 * @param request The updated digital delivery data
 * @returns The updated digital delivery record
 */
export async function update(id: number, request: DigitalDeliveryRequestType): Promise<DigitalDeliveryJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  // Check if digital delivery exists
  const existingDelivery = await fetchById(id)

  if (!existingDelivery) {
    throw new Error(`Digital delivery with ID ${id} not found`)
  }

  // Create update data object using request fields
  const updateData = {
    name: request.get('name'),
    description: request.get('description'),
    download_limit: request.get<number>('download_limit'),
    expiry_days: request.get<number>('expiry_days'),
    requires_login: request.get<boolean>('requires_login'),
    automatic_delivery: request.get<boolean>('automatic_delivery'),
    status: request.get('status'),
  }

  // If no fields to update, just return the existing digital delivery
  if (Object.keys(updateData).length === 0) {
    return existingDelivery
  }

  try {
    // Update the digital delivery
    await db
      .updateTable('digital_deliveries')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch and return the updated digital delivery
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update digital delivery: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update a digital delivery's status
 *
 * @param id The ID of the digital delivery
 * @param status The new status
 * @returns The updated digital delivery with the new status
 */
export async function updateStatus(
  id: number,
  status: string | string[],
): Promise<DigitalDeliveryJsonResponse | undefined> {
  // Check if digital delivery exists
  const digitalDelivery = await fetchById(id)

  if (!digitalDelivery) {
    throw new Error(`Digital delivery with ID ${id} not found`)
  }

  try {
    // Update the digital delivery status
    await db
      .updateTable('digital_deliveries')
      .set({
        status,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated digital delivery
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update digital delivery status: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update delivery settings for a digital delivery
 *
 * @param id The ID of the digital delivery
 * @param download_limit Optional updated download limit
 * @param expiry_days Optional updated expiry days
 * @param requires_login Optional updated requires login flag
 * @param automatic_delivery Optional updated automatic delivery flag
 * @returns The updated digital delivery
 */
export async function updateDeliverySettings(
  id: number,
  download_limit?: number,
  expiry_days?: number,
  requires_login?: boolean,
  automatic_delivery?: boolean,
): Promise<DigitalDeliveryJsonResponse | undefined> {
  // Check if digital delivery exists
  const digitalDelivery = await fetchById(id)

  if (!digitalDelivery) {
    throw new Error(`Digital delivery with ID ${id} not found`)
  }

  // Create update data with only provided fields
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (download_limit !== undefined) {
    updateData.download_limit = download_limit
  }

  if (expiry_days !== undefined) {
    updateData.expiry_days = expiry_days
  }

  if (requires_login !== undefined) {
    updateData.requires_login = requires_login
  }

  if (automatic_delivery !== undefined) {
    updateData.automatic_delivery = automatic_delivery
  }

  // If no fields to update, just return the existing digital delivery
  if (Object.keys(updateData).length === 1) { // Only updated_at was set
    return digitalDelivery
  }

  try {
    // Update the digital delivery
    await db
      .updateTable('digital_deliveries')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch the updated digital delivery
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update delivery settings: ${error.message}`)
    }

    throw error
  }
}
