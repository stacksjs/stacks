import type { ModelRow, PrintDevice, Receipt } from '@stacksjs/orm'
type PrintDeviceJsonResponse = ModelRow<typeof PrintDevice>
type ReceiptJsonResponse = ModelRow<typeof Receipt>
import { db } from '@stacksjs/database'
import { asModelRow, asModelRows } from '../utils/model-row'

/**
 * Fetch a print device by ID
 */
export async function fetchById(id: number): Promise<PrintDeviceJsonResponse | undefined> {
  const row = await db
    .selectFrom('print_devices')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  return asModelRow<PrintDeviceJsonResponse>(row, true)
}

/**
 * Fetch all print devices
 */
export async function fetchAll(): Promise<PrintDeviceJsonResponse[]> {
  return asModelRows<PrintDeviceJsonResponse>(await db.selectFrom('print_devices').selectAll().execute())
}

/**
 * Count all print devices
 */
export async function countAll(): Promise<number> {
  const result = await db
    .selectFrom('print_devices')
    .select(db.fn.count('id').as('count'))
    .executeTakeFirst() as { count: number } | undefined
  return Number(result?.count || 0)
}

/**
 * Count total prints across all print devices from receipts
 */
export async function countTotalPrints(): Promise<number> {
  const result = await db
    .selectFrom('print_devices')
    .select(db.fn.sum('print_count').as('total'))
    .executeTakeFirst()

  return Number((result)?.total || 0)
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

  return Number(result?.print_count ?? 0)
}

/**
 * Calculate error rate percentage based on receipts
 */
export async function calculateErrorRate(): Promise<number> {
  const result = await db
    .selectFrom('receipts')
    .select([
      db.fn.count('id').as('total'),
      db.fn.count('id').filterWhere('status', '=', 'failed').as('failed_count'),
    ])
    .executeTakeFirst()

  if (!(result)?.total || (result).total === 0) {
    return 0
  }

  return Number(((Number(result?.failed_count ?? 0)) / Number(result?.total ?? 0)) * 100)
}

/**
 * Fetch all errors from receipts for a specific print device
 */
export async function fetchErrorsByDeviceId(printDeviceId: number): Promise<ReceiptJsonResponse[]> {
  const rows = await db
    .selectFrom('receipts')
    .where('print_device_id', '=', printDeviceId)
    .where('status', '=', 'failed')
    .selectAll()
    .execute()

  return asModelRows<ReceiptJsonResponse>(rows)
}

/**
 * Calculate printer health percentage based on online status
 */
export async function calculatePrinterHealth(): Promise<number> {
  const result = await db
    .selectFrom('print_devices')
    .select([
      db.fn.count('id').as('total'),
      db.fn.count('id').filterWhere('status', '=', 'online').as('online_count'),
    ])
    .executeTakeFirst()

  if (!(result)?.total || (result).total === 0) {
    return 0
  }

  return Number(((Number(result?.online_count ?? 0)) / Number(result?.total ?? 0)) * 100)
}

/**
 * Get printer counts by status for visualization
 */
export async function getPrinterStatusCounts(): Promise<Record<string, number>> {
  const result = await db
    .selectFrom('print_devices')
    .select(['status', db.fn.count('id').as('count')])
    .groupBy('status')
    .execute() as { status: string, count: number }[]

  // Convert array to object with status as key and count as value
  return result.reduce((acc: any, curr: any) => {
    acc[curr.status as string] = Number(curr.count || 0)
    return acc
  }, {} as Record<string, number>)
}
