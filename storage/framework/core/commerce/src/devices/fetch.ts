type PrintDeviceJsonResponse = ModelRow<typeof PrintDevice>
type ReceiptJsonResponse = ModelRow<typeof Receipt>
import { db } from '@stacksjs/database'

/**
 * Fetch a print device by ID
 */
export async function fetchById(id: number): Promise<PrintDeviceJsonResponse | undefined> {
  return await db
    .selectFrom('print_devices')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst() as PrintDeviceJsonResponse | undefined
}

/**
 * Fetch all print devices
 */
export async function fetchAll(): Promise<PrintDeviceJsonResponse[]> {
  return await db.selectFrom('print_devices').selectAll().execute() as PrintDeviceJsonResponse[]
}

/**
 * Count all print devices
 */
export async function countAll(): Promise<number> {
  const result = await db
    .selectFrom('print_devices')
    .select(((eb: any) => eb.fn.count('id').as('count')) as any)
    .executeTakeFirst() as { count: number } | undefined
  return result?.count ?? 0
}

/**
 * Count total prints across all print devices from receipts
 */
export async function countTotalPrints(): Promise<number> {
  const result = await db
    .selectFrom('print_devices')
    .select('print_count' as any)
    .executeTakeFirst()

  return (result as any)?.print_count ?? 0
}

/**
 * Count total prints for a specific print device from receipts
 */
export async function countPrintsByDeviceId(printDeviceId: number): Promise<number> {
  const result = await db
    .selectFrom('print_devices')
    .select('print_count' as any)
    .where('id', '=', printDeviceId)
    .executeTakeFirst()

  return (result as any)?.print_count ?? 0
}

/**
 * Calculate error rate percentage based on receipts
 */
export async function calculateErrorRate(): Promise<number> {
  const result = await db
    .selectFrom('receipts')
    .select(((eb: any) => [
      eb.fn.count('id').as('total'),
      eb.fn.count('id').filterWhere('status', '=', 'error').as('error_count'),
    ]) as any)
    .executeTakeFirst()

  if (!(result as any)?.total || (result as any).total === 0) {
    return 0
  }

  return Number((((result as any).error_count ?? 0) / (result as any).total) * 100)
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
    .execute() as ReceiptJsonResponse[]
}

/**
 * Calculate printer health percentage based on online status
 */
export async function calculatePrinterHealth(): Promise<number> {
  const result = await db
    .selectFrom('print_devices')
    .select(((eb: any) => [
      eb.fn.count('id').as('total'),
      eb.fn.count('id').filterWhere('status', '=', 'online').as('online_count'),
    ]) as any)
    .executeTakeFirst()

  if (!(result as any)?.total || (result as any).total === 0) {
    return 0
  }

  return Number((((result as any).online_count ?? 0) / (result as any).total) * 100)
}

/**
 * Get printer counts by status for visualization
 */
export async function getPrinterStatusCounts(): Promise<Record<string, number>> {
  const result = await db
    .selectFrom('print_devices')
    .select(['status', (eb: any) => eb.fn.count('id').as('count')] as any)
    .groupBy('status')
    .execute() as { status: string, count: number }[]

  // Convert array to object with status as key and count as value
  return result.reduce((acc: any, curr: any) => {
    acc[curr.status as string] = curr.count
    return acc
  }, {} as Record<string, number>)
}
