import type { NewReceipt, ReceiptJsonResponse, ReceiptRequestType } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new print log
 *
 * @param request Print log data to store
 * @returns The newly created print log record
 */
export async function store(request: ReceiptRequestType): Promise<ReceiptJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare print log data
    const receiptData: NewReceipt = {
      printer: request.get('printer'),
      document: request.get('document'),
      timestamp: request.get<number>('timestamp'),
      status: request.get('status'),
      size: request.get<number>('size'),
      pages: request.get<number>('pages'),
      duration: request.get('duration'),
    }

    receiptData.uuid = randomUUIDv7()

    // Insert the print log
    const result = await db
      .insertInto('receipts')
      .values(receiptData)
      .executeTakeFirst()

    const receiptId = Number(result.insertId) || Number(result.numInsertedOrUpdatedRows)

    // Retrieve the newly created print log
    const receipt = await db
      .selectFrom('receipts')
      .where('id', '=', receiptId)
      .selectAll()
      .executeTakeFirst()

    return receipt
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create receipt: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple print logs at once
 *
 * @param requests Array of print log data to store
 * @returns Number of print logs created
 */
export async function bulkStore(requests: ReceiptRequestType[]): Promise<number> {
  if (!requests.length)
    return 0

  let createdCount = 0

  try {
    // Process each print log
    await db.transaction().execute(async (trx) => {
      for (const request of requests) {
        // Validate request data
        request.validate()

        // Prepare print log data
        const receiptData: NewReceipt = {
          printer: request.get('printer'),
          document: request.get('document'),
          timestamp: request.get<number>('timestamp'),
          status: request.get('status'),
          size: request.get<number>('size'),
          pages: request.get<number>('pages'),
          duration: request.get<number>('duration'),
        }

        receiptData.uuid = randomUUIDv7()

        // Insert the print log
        await trx
          .insertInto('receipts')
          .values(receiptData)
          .execute()

        createdCount++
      }
    })

    return createdCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create receipts in bulk: ${error.message}`)
    }

    throw error
  }
}
