import type { DriverJsonResponse, DriverUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
// Import dependencies
import { formatDate } from '@stacksjs/orm'

/**
 * Update a driver
 *
 * @param id The id of the driver to update
 * @param data The driver data to update
 * @returns The updated driver record
 */
export async function update(id: number, data: DriverUpdate): Promise<DriverJsonResponse> {
  try {
    if (!id)
      throw new Error('Driver ID is required for update')

    const result = await db
      .updateTable('drivers')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update driver')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update driver: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update a driver's status
 *
 * @param id The ID of the driver
 * @param status The new status (active, on_delivery, on_break)
 * @returns The updated driver with the new status
 */
export async function updateStatus(
  id: number,
  status: 'active' | 'on_delivery' | 'on_break',
): Promise<DriverJsonResponse> {
  try {
    const result = await db
      .updateTable('drivers')
      .set({
        status,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update driver status')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update driver status: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update driver's contact information
 *
 * @param id The ID of the driver
 * @param phone The updated phone number
 * @returns The updated driver
 */
export async function updateContact(
  id: number,
  phone?: string,
): Promise<DriverJsonResponse> {
  try {
    const updateData: Record<string, any> = {
      updated_at: formatDate(new Date()),
    }

    if (phone !== undefined)
      updateData.phone = phone

    const result = await db
      .updateTable('drivers')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update contact information')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update contact information: ${error.message}`)
    }

    throw error
  }
}
