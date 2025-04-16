import type { NewReceipt, ReceiptJsonResponse } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new receipt
 *
 * @param data The receipt data to store
 * @returns The newly created receipt record
 */
export async function store(data: NewReceipt): Promise<ReceiptJsonResponse> {
  try {
    const receiptData = {
      ...data,
      uuid: randomUUIDv7(),
    }

    const result = await db
      .insertInto('receipts')
      .values(receiptData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create receipt')

    return result
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
      uuid: randomUUIDv7(),
    }))

    const result = await db
      .insertInto('receipts')
      .values(receiptDataArray)
      .executeTakeFirst()

    return Number(result.numInsertedOrUpdatedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create receipts in bulk: ${error.message}`)
    }

    throw error
  }
}
