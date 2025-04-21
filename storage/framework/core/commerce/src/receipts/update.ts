import type { ReceiptJsonResponse, ReceiptUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Update a receipt
 *
 * @param id The id of the receipt to update
 * @param data The receipt data to update
 * @returns The updated receipt record
 */
export async function update(id: number, data: ReceiptUpdate): Promise<ReceiptJsonResponse> {
  try {
    if (!id)
      throw new Error('Receipt ID is required for update')

    const result = await db
      .updateTable('receipts')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update receipt')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update receipt: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update a receipt's status
 *
 * @param id The ID of the receipt
 * @param status The new status
 * @returns The updated receipt with the new status
 */
export async function updateStatus(
  id: number,
  status: 'success' | 'failed' | 'warning',
): Promise<ReceiptJsonResponse> {
  try {
    const result = await db
      .updateTable('receipts')
      .set({
        status,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update receipt status')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update receipt status: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update print job information
 *
 * @param id The ID of the receipt
 * @param size Optional new size value
 * @param pages Optional new pages value
 * @param duration Optional new duration value
 * @returns The updated receipt
 */
export async function updatePrintJob(
  id: number,
  size?: number,
  pages?: number,
  duration?: number,
): Promise<ReceiptJsonResponse> {
  try {
    const updateData: Record<string, any> = {
      updated_at: formatDate(new Date()),
    }

    if (size !== undefined)
      updateData.size = size
    if (pages !== undefined)
      updateData.pages = pages
    if (duration !== undefined)
      updateData.duration = duration

    const result = await db
      .updateTable('receipts')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update receipt job information')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update receipt job information: ${error.message}`)
    }

    throw error
  }
}
