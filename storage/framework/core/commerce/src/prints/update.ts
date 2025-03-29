import type { PrintLogJsonResponse, PrintLogRequestType } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { fetchById } from './fetch'

/**
 * Update a print log by ID
 *
 * @param id The ID of the print log to update
 * @param request The updated print log data
 * @returns The updated print log record
 */
export async function update(id: number, request: PrintLogRequestType): Promise<PrintLogJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  // Check if print log exists
  const existingLog = await fetchById(id)

  if (!existingLog) {
    throw new Error(`Print log with ID ${id} not found`)
  }

  // Create update data object using request fields
  const updateData = {
    printer: request.get('printer'),
    document: request.get('document'),
    timestamp: request.get<number>('timestamp'),
    status: request.get('status'),
    size: request.get<number>('size'),
    pages: request.get<number>('pages'),
    duration: request.get<number>('duration'),
    updated_at: formatDate(new Date()),
  }

  // If no fields to update, just return the existing print log
  if (Object.keys(updateData).length === 0) {
    return existingLog
  }

  try {
    // Update the print log
    await db
      .updateTable('print_logs')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch and return the updated print log
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update print log: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update a print log's status
 *
 * @param id The ID of the print log
 * @param status The new status
 * @returns The updated print log with the new status
 */
export async function updateStatus(
  id: number,
  status: 'success' | 'failed' | 'warning',
): Promise<PrintLogJsonResponse | undefined> {
  // Check if print log exists
  const printLog = await fetchById(id)

  if (!printLog) {
    throw new Error(`Print log with ID ${id} not found`)
  }

  try {
    // Update the print log status
    await db
      .updateTable('print_logs')
      .set({
        status,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated print log
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update print log status: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update print job information
 *
 * @param id The ID of the print log
 * @param size Optional new size value
 * @param pages Optional new pages value
 * @param duration Optional new duration value
 * @returns The updated print log
 */
export async function updatePrintJob(
  id: number,
  size?: number,
  pages?: number,
  duration?: number,
): Promise<PrintLogJsonResponse | undefined> {
  // Check if print log exists
  const printLog = await fetchById(id)

  if (!printLog) {
    throw new Error(`Print log with ID ${id} not found`)
  }

  // Create update data with only provided fields
  const updateData: Record<string, any> = {
    updated_at: formatDate(new Date()),
  }

  if (size !== undefined) {
    updateData.size = size
  }
  if (pages !== undefined) {
    updateData.pages = pages
  }
  if (duration !== undefined) {
    updateData.duration = duration
  }

  // If no fields to update, just return the existing print log
  if (Object.keys(updateData).length === 1) { // Only updated_at was set
    return printLog
  }

  try {
    // Update the print log
    await db
      .updateTable('print_logs')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch the updated print log
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update print job information: ${error.message}`)
    }

    throw error
  }
}
