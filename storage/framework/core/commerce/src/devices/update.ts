import type { PrintDeviceJsonResponse, PrintDeviceRequestType } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { fetchById } from './fetch'

/**
 * Update a print device by ID
 *
 * @param id The ID of the print device to update
 * @param request The updated print device data
 * @returns The updated print device record
 */
export async function update(id: number, request: PrintDeviceRequestType): Promise<PrintDeviceJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  // Check if print device exists
  const existingDevice = await fetchById(id)

  if (!existingDevice) {
    throw new Error(`Print device with ID ${id} not found`)
  }

  // Create update data object using request fields
  const updateData = {
    name: request.get('name'),
    mac_address: request.get('mac_address'),
    location: request.get('location'),
    terminal: request.get('terminal'),
    status: request.get('status'),
    last_ping: request.get<number>('last_ping'),
    print_count: request.get<number>('print_count'),
    updated_at: formatDate(new Date()),
  }

  // If no fields to update, just return the existing print device
  if (Object.keys(updateData).length === 0) {
    return existingDevice
  }

  try {
    // Update the print device
    await db
      .updateTable('print_devices')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch and return the updated print device
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update print device: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update a print device's status
 *
 * @param id The ID of the print device
 * @param status The new status
 * @returns The updated print device with the new status
 */
export async function updateStatus(
  id: number,
  status: 'online' | 'offline' | 'warning',
): Promise<PrintDeviceJsonResponse | undefined> {
  // Check if print device exists
  const printDevice = await fetchById(id)

  if (!printDevice) {
    throw new Error(`Print device with ID ${id} not found`)
  }

  try {
    // Update the print device status
    await db
      .updateTable('print_devices')
      .set({
        status,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated print device
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update print device status: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update print count for a print device
 *
 * @param id The ID of the print device
 * @param printCount The updated print count value
 * @returns The updated print device
 */
export async function updatePrintCount(
  id: number,
  printCount?: number,
): Promise<PrintDeviceJsonResponse | undefined> {
  // Check if print device exists
  const printDevice = await fetchById(id)

  if (!printDevice) {
    throw new Error(`Print device with ID ${id} not found`)
  }

  // Create update data with only provided fields
  const updateData: Record<string, any> = {
    updated_at: formatDate(new Date()),
  }

  if (printCount !== undefined) {
    updateData.print_count = printCount
  }

  // If no print count fields to update, just return the existing print device
  if (Object.keys(updateData).length === 1) { // Only updated_at was set
    return printDevice
  }

  try {
    // Update the print device
    await db
      .updateTable('print_devices')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch the updated print device
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update print count: ${error.message}`)
    }

    throw error
  }
}
