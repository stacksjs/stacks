import type { PrintLogJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a print log by ID
 */
export async function fetchById(id: number): Promise<PrintLogJsonResponse | undefined> {
  return await db
    .selectFrom('print_logs')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all print logs
 */
export async function fetchAll(): Promise<PrintLogJsonResponse[]> {
  return await db.selectFrom('print_logs').selectAll().execute()
}
