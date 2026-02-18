import type { ReceiptJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Fetch a print log by ID
 */
export async function fetchById(id: number): Promise<ReceiptJsonResponse | undefined> {
  return await db
    .selectFrom('receipts')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all print logs
 */
export async function fetchAll(): Promise<ReceiptJsonResponse[]> {
  return await db.selectFrom('receipts').selectAll().execute()
}

/**
 * Fetch print job statistics by status within a date range
 *
 * @param startDate Start date for the range
 * @param endDate End date for the range
 * @returns Object containing counts for each status and total
 */
export async function fetchPrintJobStats(
  startDate: Date,
  endDate: Date,
): Promise<{
    total: number
    success: number
    failed: number
    warning: number
    averageSize: number
    averagePages: number
    averageDuration: number
  }> {
  const stats = await db
    .selectFrom('receipts')
    .where('timestamp', '>=', formatDate(startDate))
    .where('timestamp', '<=', endDate)
    .select([
      db.fn.count('id').as('total'),
      (db.fn.count('id') as any).filterWhere('status', '=', 'success').as('success'),
      (db.fn.count('id') as any).filterWhere('status', '=', 'failed').as('failed'),
      (db.fn.count('id') as any).filterWhere('status', '=', 'warning').as('warning'),
      db.fn.avg('size').as('averageSize'),
      db.fn.avg('pages').as('averagePages'),
      db.fn.avg('duration').as('averageDuration'),
    ])
    .executeTakeFirst()

  return {
    total: (stats as any)?.total || 0,
    success: (stats as any)?.success || 0,
    failed: (stats as any)?.failed || 0,
    warning: (stats as any)?.warning || 0,
    averageSize: Math.round((stats as any)?.averageSize || 0),
    averagePages: Math.round((stats as any)?.averagePages || 0),
    averageDuration: Math.round((stats as any)?.averageDuration || 0),
  }
}

/**
 * Calculate the success rate percentage for print jobs within a date range
 *
 * @param startDate Start date for the range
 * @param endDate End date for the range
 * @returns Object containing success rate percentage and detailed counts
 */
export async function fetchSuccessRate(
  startDate: Date,
  endDate: Date,
): Promise<{
    successRate: number
    total: number
    success: number
    failed: number
    warning: number
  }> {
  const stats = await db
    .selectFrom('receipts')
    .where('timestamp', '>=', formatDate(startDate))
    .where('timestamp', '<=', formatDate(endDate))
    .select([
      db.fn.count('id').as('total'),
      (db.fn.count('id') as any).filterWhere('status', '=', 'success').as('success'),
      (db.fn.count('id') as any).filterWhere('status', '=', 'failed').as('failed'),
      (db.fn.count('id') as any).filterWhere('status', '=', 'warning').as('warning'),
    ])
    .executeTakeFirst()

  const total = (stats as any)?.total || 0
  const success = (stats as any)?.success || 0
  const failed = (stats as any)?.failed || 0
  const warning = (stats as any)?.warning || 0

  // Calculate success rate as percentage of successful jobs vs total jobs
  const successRate = total > 0 ? Math.round((success / total) * 100) : 0

  return {
    successRate,
    total,
    success,
    failed,
    warning,
  }
}

/**
 * Calculate total pages and average pages per receipt within a date range
 *
 * @param startDate Start date for the range
 * @param endDate End date for the range
 * @returns Object containing total pages and average pages per receipt
 */
export async function fetchPageStats(
  startDate: Date,
  endDate: Date,
): Promise<{
    totalPages: number
    averagePagesPerReceipt: number
    totalReceipts: number
  }> {
  const stats = await db
    .selectFrom('receipts')
    .where('timestamp', '>=', formatDate(startDate))
    .where('timestamp', '<=', formatDate(endDate))
    .select([
      db.fn.count('id').as('totalReceipts'),
      db.fn.sum('pages').as('totalPages'),
      db.fn.avg('pages').as('averagePagesPerReceipt'),
    ])
    .executeTakeFirst()

  return {
    totalPages: (stats as any)?.totalPages || 0,
    averagePagesPerReceipt: Math.round((stats as any)?.averagePagesPerReceipt || 0),
    totalReceipts: (stats as any)?.totalReceipts || 0,
  }
}

/**
 * Calculate average print time statistics within a date range
 *
 * @param startDate Start date for the range
 * @param endDate End date for the range
 * @returns Object containing average print time and related statistics
 */
export async function fetchPrintTimeStats(
  startDate: Date,
  endDate: Date,
): Promise<{
    averageDuration: number
    minDuration: number
    maxDuration: number
    totalJobs: number
  }> {
  const stats = await db
    .selectFrom('receipts')
    .where('timestamp', '>=', formatDate(startDate))
    .where('timestamp', '<=', formatDate(endDate))
    .select([
      db.fn.count('id').as('totalJobs'),
      db.fn.avg('duration').as('averageDuration'),
      db.fn.min('duration').as('minDuration'),
      db.fn.max('duration').as('maxDuration'),
    ])
    .executeTakeFirst()

  return {
    averageDuration: Math.round((stats as any)?.averageDuration || 0),
    minDuration: (stats as any)?.minDuration || 0,
    maxDuration: (stats as any)?.maxDuration || 0,
    totalJobs: (stats as any)?.totalJobs || 0,
  }
}

/**
 * Calculate prints per hour statistics within a date range
 *
 * @param startDate Start date for the range
 * @param endDate End date for the range
 * @returns Object containing prints per hour statistics
 */
export async function fetchPrintsPerHour(
  startDate: Date,
  endDate: Date,
): Promise<{
    totalPrints: number
    totalHours: number
    printsPerHour: number
    hourlyBreakdown: Array<{
      hour: number
      count: number
    }>
  }> {
  const receipts = await db
    .selectFrom('receipts')
    .where('timestamp', '>=', formatDate(startDate))
    .where('timestamp', '<=', formatDate(endDate))
    .selectAll()
    .execute()

  const totalPrints = receipts.length
  const totalHours = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60))
  const printsPerHour = totalHours > 0 ? Math.round(totalPrints / totalHours) : 0

  const hourlyBreakdown = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: 0,
  }))

  receipts.forEach((receipt: any) => {
    const date = new Date(receipt.timestamp)
    const hour = date.getHours()
    hourlyBreakdown[hour].count++
  })

  return {
    totalPrints,
    totalHours,
    printsPerHour,
    hourlyBreakdown,
  }
}
