import type { DigitalDeliveryJsonResponse, DigitalDeliveryUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
// Import dependencies
import { formatDate } from '@stacksjs/orm'

/**
 * Update a digital delivery
 *
 * @param id The id of the digital delivery to update
 * @param data The digital delivery data to update
 * @returns The updated digital delivery record
 */
export async function update(id: number, data: DigitalDeliveryUpdate): Promise<DigitalDeliveryJsonResponse> {
  try {
    if (!id)
      throw new Error('Digital delivery ID is required for update')

    const result = await db
      .updateTable('digital_deliveries')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update digital delivery')

    return result
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
): Promise<DigitalDeliveryJsonResponse> {
  try {
    const result = await db
      .updateTable('digital_deliveries')
      .set({
        status,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update digital delivery status')

    return result
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
): Promise<DigitalDeliveryJsonResponse> {
  try {
    const updateData: Record<string, any> = {
      updated_at: formatDate(new Date()),
    }

    if (download_limit !== undefined)
      updateData.download_limit = download_limit
    if (expiry_days !== undefined)
      updateData.expiry_days = expiry_days
    if (requires_login !== undefined)
      updateData.requires_login = requires_login
    if (automatic_delivery !== undefined)
      updateData.automatic_delivery = automatic_delivery

    const result = await db
      .updateTable('digital_deliveries')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update delivery settings')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update delivery settings: ${error.message}`)
    }

    throw error
  }
}
