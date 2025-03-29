import type { NewPrintLog, PrintLogJsonResponse, PrintLogRequestType } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new print log
 *
 * @param request Print log data to store
 * @returns The newly created print log record
 */
export async function store(request: PrintLogRequestType): Promise<PrintLogJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare print log data
    const printData: NewPrintLog = {
      printer: request.get('printer'),
      document: request.get('document'),
      timestamp: request.get<number>('timestamp'),
      status: request.get('status'),
      size: request.get<number>('size'),
      pages: request.get<number>('pages'),
      duration: request.get('duration'),
    }

    printData.uuid = randomUUIDv7()

    // Insert the print log
    const result = await db
      .insertInto('print_logs')
      .values(printData)
      .executeTakeFirst()

    const printId = Number(result.insertId) || Number(result.numInsertedOrUpdatedRows)

    // Retrieve the newly created print log
    const printLog = await db
      .selectFrom('print_logs')
      .where('id', '=', printId)
      .selectAll()
      .executeTakeFirst()

    return printLog
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create print log: ${error.message}`)
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
export async function bulkStore(requests: PrintLogRequestType[]): Promise<number> {
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
        const printData: NewPrintLog = {
          printer: request.get('printer'),
          document: request.get('document'),
          timestamp: request.get<number>('timestamp'),
          status: request.get('status'),
          size: request.get<number>('size'),
          pages: request.get<number>('pages'),
          duration: request.get<number>('duration'),
        }

        printData.uuid = randomUUIDv7()

        // Insert the print log
        await trx
          .insertInto('print_logs')
          .values(printData)
          .execute()

        createdCount++
      }
    })

    return createdCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create print logs in bulk: ${error.message}`)
    }

    throw error
  }
}
