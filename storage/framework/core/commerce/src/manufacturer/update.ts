import type { ManufacturerJsonResponse, ManufacturerRequestType } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { fetchById } from './fetch'

/**
 * Update a manufacturer by ID
 *
 * @param id The ID of the manufacturer to update
 * @param request The updated manufacturer data
 * @returns The updated manufacturer record
 */
export async function update(id: number, request: ManufacturerRequestType): Promise<ManufacturerJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  // Check if manufacturer exists
  const existingManufacturer = await fetchById(id)
  if (!existingManufacturer) {
    throw new Error(`Manufacturer with ID ${id} not found`)
  }

  // Create update data object using request fields
  const updateData: Record<string, any> = {
    manufacturer: request.get('manufacturer'),
    description: request.get('description'),
    country: request.get('country'),
    featured: request.get<boolean>('featured'),
    updated_at: formatDate(new Date()),
  }

  // Remove undefined fields to avoid overwriting with null values
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] === undefined) {
      delete updateData[key]
    }
  })

  // If no fields to update, just return the existing manufacturer
  if (Object.keys(updateData).length === 1) { // Only updated_at was set
    return existingManufacturer
  }

  try {
    // Update the manufacturer
    await db
      .updateTable('manufacturers')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch and return the updated manufacturer
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      // Handle duplicate name error if you have unique constraints
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
): Promise<ManufacturerJsonResponse | undefined> {
  // Check if manufacturer exists
  const manufacturer = await fetchById(id)

  if (!manufacturer) {
    throw new Error(`Manufacturer with ID ${id} not found`)
  }

  // If featured is not provided, toggle the current value
  const newFeaturedStatus = featured !== undefined ? featured : !manufacturer.featured

  try {
    // Update the manufacturer featured status
    await db
      .updateTable('manufacturers')
      .set({
        featured: newFeaturedStatus,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated manufacturer
    return await fetchById(id)
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
 * @param request The updated manufacturer data
 * @returns The updated manufacturer record
 */
export async function updateByUuid(uuid: string, request: ManufacturerRequestType): Promise<ManufacturerJsonResponse | undefined> {
  try {
    // Find the manufacturer by UUID
    const manufacturer = await db
      .selectFrom('manufacturers')
      .where('uuid', '=', uuid)
      .selectAll()
      .executeTakeFirst()

    if (!manufacturer) {
      throw new Error(`Manufacturer with UUID ${uuid} not found`)
    }

    // Use the regular update function with the ID
    return await update(manufacturer.id, request)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update manufacturer: ${error.message}`)
    }

    throw error
  }
}
