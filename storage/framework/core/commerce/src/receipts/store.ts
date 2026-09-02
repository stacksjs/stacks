import type { ModelRow, NewModelData, Receipt } from '@stacksjs/orm'
type ReceiptJsonResponse = ModelRow<typeof Receipt>
type NewReceipt = NewModelData<typeof Receipt>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { asModelRow } from '../utils/model-row'
import { receiptTimestamp } from './timestamp'

/**
 * Create a new receipt
 *
 * @param data The receipt data to store
 * @returns The newly created receipt record
 */
export async function store(data: NewReceipt): Promise<ReceiptJsonResponse> {
  try {
    const uuid = randomUUIDv7()
    const receiptData = {
      ...data,
      timestamp: receiptTimestamp(data.timestamp),
      uuid,
    }

    await db
      .insertInto('receipts')
      .values(receiptData)
      .executeTakeFirst()

    const result = await db
      .selectFrom('receipts')
      .where('uuid', '=', uuid)
      .selectAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create receipt')

    return asModelRow<ReceiptJsonResponse>(result)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create receipt: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple receipts at once
 *
 * @param data Array of receipt data to store
 * @returns Number of receipts created
 */
export async function bulkStore(data: NewReceipt[]): Promise<number> {
  if (!data.length)
    return 0

  try {
    const receiptDataArray = data.map(item => ({
      ...item,
      timestamp: receiptTimestamp(item.timestamp),
      uuid: randomUUIDv7(),
    }))

    const result = await db
      .insertInto('receipts')
      .values(receiptDataArray)
      .executeTakeFirst()

    /*
     * Four field names, because drivers disagree about what an insert reports -
     * and the receipt itself can be absent, which this read straight through
     * before the types said so.
     */
    const receipt = (result ?? {}) as {
      numInsertedOrUpdatedRows?: unknown
      numAffectedRows?: unknown
      affectedRows?: unknown
      changes?: unknown
    }

    return Number(
      receipt.numInsertedOrUpdatedRows
      ?? receipt.numAffectedRows
      ?? receipt.affectedRows
      ?? receipt.changes
      ?? 0,
    )
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create receipts in bulk: ${error.message}`)
    }

    throw error
  }
}
