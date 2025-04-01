import type { PrintDeviceJsonResponse, ReceiptJsonResponse } from '@stacksjs/orm'
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

/**
 * Calculate error rate percentage based on receipts
 */
export async function calculateErrorRate(): Promise<number> {
  const result = await db
    .selectFrom('receipts')
    .select([
      db.fn.count<number>('id').as('total'),
      db.fn.count<number>('id')
        .filterWhere('status', '=', 'error')
        .as('error_count'),
    ])
    .executeTakeFirst()

  if (!result?.total || result.total === 0) {
    return 0
  }

  return Number(((result.error_count ?? 0) / result.total) * 100)
}

/**
 * Fetch all errors from receipts for a specific print device
 */
export async function fetchErrorsByDeviceId(printDeviceId: number): Promise<ReceiptJsonResponse[]> {
  return await db
    .selectFrom('receipts')
    .where('print_device_id', '=', printDeviceId)
    .where('status', '=', 'error')
    .selectAll()
    .execute()
}

/**
 * Calculate printer health percentage based on online status
 */
export async function calculatePrinterHealth(): Promise<number> {
  const result = await db
    .selectFrom('print_devices')
    .select([
      db.fn.count<number>('id').as('total'),
      db.fn.count<number>('id')
        .filterWhere('status', '=', 'online')
        .as('online_count'),
    ])
    .executeTakeFirst()

  if (!result?.total || result.total === 0) {
    return 0
  }

  return Number(((result.online_count ?? 0) / result.total) * 100)
}

/**
 * Get printer counts by status for visualization
 */
export async function getPrinterStatusCounts(): Promise<Record<string, number>> {
  const result = await db
    .selectFrom('print_devices')
    .select([
      'status',
      db.fn.count<number>('id').as('count'),
    ])
    .groupBy('status')
    .execute()

  // Convert array to object with status as key and count as value
  return result.reduce((acc, curr) => {
    acc[curr.status as string] = curr.count
    return acc
  }, {} as Record<string, number>)
}
