import type { ModelRow, NewModelData, Receipt } from '@stacksjs/orm'
type ReceiptJsonResponse = ModelRow<typeof Receipt>
type NewReceipt = NewModelData<typeof Receipt>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
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

    return result as ReceiptJsonResponse
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

    return Number(
      result.numInsertedOrUpdatedRows
      ?? (result as any).numAffectedRows
      ?? (result as any).affectedRows
      ?? (result as any).changes
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
