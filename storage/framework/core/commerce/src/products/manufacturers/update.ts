import type { ManufacturerJsonResponse, ManufacturerUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Update a manufacturer
 *
 * @param id The ID of the manufacturer to update
 * @param data The manufacturer data to update
 * @returns The updated manufacturer record
 */
export async function update(id: number, data: ManufacturerUpdate): Promise<ManufacturerJsonResponse> {
  try {
    if (!id)
      throw new Error('Manufacturer ID is required for update')

    const result = await db
      .updateTable('manufacturers')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update manufacturer')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Duplicate entry') && error.message.includes('manufacturer')) {
        throw new Error('A manufacturer with this name already exists')
      }

      throw new Error(`Failed to update manufacturer: ${error.message}`)
    }

    throw error
  }
}

/**
 * Toggle the featured status of a manufacturer
 *
 * @param id The ID of the manufacturer
 * @param featured The new featured status (or toggle if not provided)
 * @returns The updated manufacturer with the new featured status
 */
export async function updateFeaturedStatus(
  id: number,
  featured?: boolean,
): Promise<ManufacturerJsonResponse> {
  try {
    const result = await db
      .updateTable('manufacturers')
      .set({
        featured,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update manufacturer featured status')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update manufacturer featured status: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update a manufacturer by UUID
 *
 * @param uuid The UUID of the manufacturer to update
 * @param data The updated manufacturer data
 * @returns The updated manufacturer record
 */
export async function updateByUuid(uuid: string, data: Omit<ManufacturerUpdate, 'id'>): Promise<ManufacturerJsonResponse> {
  try {
    const result = await db
      .updateTable('manufacturers')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('uuid', '=', uuid)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update manufacturer')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update manufacturer: ${error.message}`)
    }

    throw error
  }
}
