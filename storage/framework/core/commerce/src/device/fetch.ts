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

/**
 * Count total prints across all print devices from receipts
 */
export async function countTotalPrints(): Promise<number> {
  const result = await db
    .selectFrom('print_devices')
    .select('print_count')
    .executeTakeFirst()

  return result?.print_count ?? 0
}

/**
 * Count total prints for a specific print device from receipts
 */
export async function countPrintsByDeviceId(printDeviceId: number): Promise<number> {
  const result = await db
    .selectFrom('print_devices')
    .select('print_count')
    .where('id', '=', printDeviceId)
    .executeTakeFirst()

  return result?.print_count ?? 0
}
