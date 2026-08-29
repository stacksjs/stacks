import type { Courier, ModelRow, UpdateModelData } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
// Import dependencies
import { formatDate } from '@stacksjs/orm'
import { courierWriteData } from '../write-data'
type CourierJsonResponse = ModelRow<typeof Courier>
type CourierUpdate = UpdateModelData<typeof Courier>

/**
 * Update a courier
 *
 * @param id The id of the courier to update
 * @param data The courier data to update
 * @returns The updated courier record
 */
export async function update(id: number, data: CourierUpdate): Promise<CourierJsonResponse | undefined> {
  try {
    if (!id)
      throw new Error('Courier ID is required for update')

    const result = await db
      .updateTable('couriers')
      .set({
        ...courierWriteData(data as Record<string, unknown>),
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      return undefined

    return result as CourierJsonResponse
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update courier: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update a courier's status
 *
 * @param id The ID of the courier
 * @param status The new status (active, on_delivery, on_break)
 * @returns The updated courier with the new status
 */
export async function updateStatus(
  id: number,
  status: 'active' | 'on_delivery' | 'on_break',
): Promise<CourierJsonResponse> {
  try {
    const result = await db
      .updateTable('couriers')
      .set({
        status,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update courier status')

    return result as CourierJsonResponse
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update courier status: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update courier's contact information
 *
 * @param id The ID of the courier
 * @param phone The updated phone number
 * @returns The updated courier
 */
export async function updateContact(
  id: number,
  phone?: string,
): Promise<CourierJsonResponse> {
  try {
    const updateData: Record<string, any> = {
      updated_at: formatDate(new Date()),
    }

    if (phone !== undefined)
      updateData.phone = phone

    const result = await db
      .updateTable('couriers')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update contact information')

    return result as CourierJsonResponse
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update contact information: ${error.message}`)
    }

    throw error
  }
}
