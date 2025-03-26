// Import dependencies
import type { DriverJsonResponse, DriverRequestType } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { fetchById } from './fetch'

/**
 * Update a driver by ID
 *
 * @param id The ID of the driver to update
 * @param request The updated driver data
 * @returns The updated driver record
 */
export async function update(id: number, request: DriverRequestType): Promise<DriverJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  // Check if driver exists
  const existingDriver = await fetchById(id)

  if (!existingDriver) {
    throw new Error(`Driver with ID ${id} not found`)
  }

  // Create update data object using request fields
  const updateData = {
    name: request.get('name'),
    phone: request.get('phone'),
    vehicle_number: request.get('vehicle_number'),
    license: request.get('license'),
    status: request.get('status'),
  }

  // If no fields to update, just return the existing driver
  if (Object.keys(updateData).length === 0) {
    return existingDriver
  }

  try {
    // Update the driver
    await db
      .updateTable('drivers')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch and return the updated driver
    return await fetchById(id)
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
): Promise<DriverJsonResponse | undefined> {
  // Check if driver exists
  const driver = await fetchById(id)

  if (!driver) {
    throw new Error(`Driver with ID ${id} not found`)
  }

  try {
    // Update the driver status
    await db
      .updateTable('drivers')
      .set({
        status,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated driver
    return await fetchById(id)
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
): Promise<DriverJsonResponse | undefined> {
  // Check if driver exists
  const driver = await fetchById(id)

  if (!driver) {
    throw new Error(`Driver with ID ${id} not found`)
  }

  // Create update data with only provided fields
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (phone !== undefined) {
    updateData.phone = phone
  }

  // If no contact fields to update, just return the existing driver
  if (Object.keys(updateData).length === 1) { // Only updated_at was set
    return driver
  }

  try {
    // Update the driver
    await db
      .updateTable('drivers')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch the updated driver
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update contact information: ${error.message}`)
    }

    throw error
  }
}
