import type { PrintDeviceJsonResponse, PrintDeviceUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { fetchById } from './fetch'

/**
 * Update a print device by ID
 *
 * @param id The ID of the print device to update
 * @param data The updated print device data
 * @returns The updated print device record
 */
export async function update(id: number, data: Omit<PrintDeviceUpdate, 'id'>): Promise<PrintDeviceJsonResponse | undefined> {
  // Check if print device exists
  const existingDevice = await fetchById(id)

  if (!existingDevice) {
    throw new Error(`Print device with ID ${id} not found`)
  }

  try {
    // Update the print device
    await db
      .updateTable('print_devices')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
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

  try {
    // Update the print device
    await db
      .updateTable('print_devices')
      .set({
        print_count: printCount,
        updated_at: formatDate(new Date()),
      })
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
