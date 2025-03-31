import type { PrintDeviceJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a print device by ID
 */
export async function fetchById(id: number): Promise<PrintDeviceJsonResponse | undefined> {
  return await db
    .selectFrom('print_devices')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all print devices
 */
export async function fetchAll(): Promise<PrintDeviceJsonResponse[]> {
  return await db.selectFrom('print_devices').selectAll().execute()
}

/**
 * Count all print devices
 */
export async function countAll(): Promise<number> {
  return await db
    .selectFrom('print_devices')
    .select(db.fn.count<number>('id').as('count'))
    .executeTakeFirst()
    .then(result => result?.count ?? 0)
}
