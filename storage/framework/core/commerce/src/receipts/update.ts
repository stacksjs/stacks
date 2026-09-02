import type { ModelRow, Receipt, UpdateModelData } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { asModelRow } from '../utils/model-row'
import { formatDate } from '@stacksjs/orm'
import { fetchById } from './fetch'
import { receiptTimestamp } from './timestamp'
type ReceiptJsonResponse = ModelRow<typeof Receipt>
type ReceiptUpdate = UpdateModelData<typeof Receipt>

/**
 * Update a receipt
 *
 * @param id The id of the receipt to update
 * @param data The receipt data to update
 * @returns The updated receipt record
 */
export async function update(id: number, data: ReceiptUpdate): Promise<ReceiptJsonResponse | undefined> {
  try {
    if (!id)
      throw new Error('Receipt ID is required for update')

    const updateData = {
      ...data,
      ...(data.timestamp === undefined ? {} : { timestamp: receiptTimestamp(data.timestamp) }),
      updated_at: formatDate(new Date()),
    }
    await db
      .updateTable('receipts')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    const result = await fetchById(id)
    if (!result)
      return undefined

    return asModelRow<ReceiptJsonResponse>(result)
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
    await db
      .updateTable('receipts')
      .set({
        status,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    const result = await fetchById(id)
    if (!result)
      throw new Error('Failed to update receipt status')

    return asModelRow<ReceiptJsonResponse>(result)
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

    await db
      .updateTable('receipts')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    const result = await fetchById(id)
    if (!result)
      throw new Error('Failed to update receipt job information')

    return asModelRow<ReceiptJsonResponse>(result)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update receipt job information: ${error.message}`)
    }

    throw error
  }
}
