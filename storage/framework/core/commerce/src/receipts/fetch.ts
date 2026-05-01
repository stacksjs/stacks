import { db } from '@stacksjs/database'
import { aggregateStats } from '../utils/typed-stats'
type ReceiptJsonResponse = ModelRow<typeof Receipt>

/**
 * Fetch a print log by ID
 */
export async function fetchById(id: number): Promise<ReceiptJsonResponse | undefined> {
  // Single `as` at the kysely → typed-result boundary — schema-wide
  // typing for `selectAll()` would force every consumer to import the
  // generated row types, which we want to keep optional in user code.
  return await db
    .selectFrom('receipts')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst() as ReceiptJsonResponse | undefined
}

/**
 * Fetch all print logs
 */
export async function fetchAll(): Promise<ReceiptJsonResponse[]> {
  return await db.selectFrom('receipts').selectAll().execute() as ReceiptJsonResponse[]
}

/**
 * Fetch print job statistics by status within a date range
 *
 * @param startDate Start date for the range
 * @param endDate End date for the range
 * @returns Object containing counts for each status and total
 */
export async function fetchPrintJobStats(
  _startDate: Date | number,
  _endDate: Date | number,
): Promise<{
    total: number
    success: number
    failed: number
    warning: number
    averageSize: number
    averagePages: number
    averageDuration: number
  }> {
  const start = typeof _startDate === 'number' ? _startDate : _startDate.getTime()
  const end = typeof _endDate === 'number' ? _endDate : _endDate.getTime()

  const stats = await aggregateStats('receipts', {
    total: { kind: 'count' },
    success: { kind: 'count', filter: { column: 'status', op: '=', value: 'success' } },
    failed: { kind: 'count', filter: { column: 'status', op: '=', value: 'failed' } },
    warning: { kind: 'count', filter: { column: 'status', op: '=', value: 'warning' } },
    averageSize: { kind: 'avg', column: 'size' },
    averagePages: { kind: 'avg', column: 'pages' },
    averageDuration: { kind: 'avg', column: 'duration' },
  }, qb => qb.where('timestamp', '>=', start).where('timestamp', '<=', end))

  return {
    total: stats.total,
    success: stats.success,
    failed: stats.failed,
    warning: stats.warning,
    averageSize: Math.round(stats.averageSize),
    averagePages: Math.round(stats.averagePages),
    averageDuration: Math.round(stats.averageDuration),
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
  _startDate: Date | number,
  _endDate: Date | number,
): Promise<{
    successRate: number
    total: number
    success: number
    failed: number
    warning: number
  }> {
  const start = typeof _startDate === 'number' ? _startDate : _startDate.getTime()
  const end = typeof _endDate === 'number' ? _endDate : _endDate.getTime()

  const stats = await aggregateStats('receipts', {
    total: { kind: 'count' },
    success: { kind: 'count', filter: { column: 'status', op: '=', value: 'success' } },
    failed: { kind: 'count', filter: { column: 'status', op: '=', value: 'failed' } },
    warning: { kind: 'count', filter: { column: 'status', op: '=', value: 'warning' } },
  }, qb => qb.where('timestamp', '>=', start).where('timestamp', '<=', end))

  const successRate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0

  return {
    successRate,
    total: stats.total,
    success: stats.success,
    failed: stats.failed,
    warning: stats.warning,
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
  _startDate: Date | number,
  _endDate: Date | number,
): Promise<{
    totalPages: number
    averagePagesPerReceipt: number
    totalReceipts: number
  }> {
  const start = typeof _startDate === 'number' ? _startDate : _startDate.getTime()
  const end = typeof _endDate === 'number' ? _endDate : _endDate.getTime()

  const stats = await aggregateStats('receipts', {
    totalReceipts: { kind: 'count' },
    totalPages: { kind: 'sum', column: 'pages' },
    averagePagesPerReceipt: { kind: 'avg', column: 'pages' },
  }, qb => qb.where('timestamp', '>=', start).where('timestamp', '<=', end))

  return {
    totalPages: stats.totalPages,
    averagePagesPerReceipt: Math.round(stats.averagePagesPerReceipt),
    totalReceipts: stats.totalReceipts,
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
  _startDate: Date | number,
  _endDate: Date | number,
): Promise<{
    averageDuration: number
    minDuration: number
    maxDuration: number
    totalJobs: number
  }> {
  const start = typeof _startDate === 'number' ? _startDate : _startDate.getTime()
  const end = typeof _endDate === 'number' ? _endDate : _endDate.getTime()

  const stats = await aggregateStats('receipts', {
    totalJobs: { kind: 'count' },
    averageDuration: { kind: 'avg', column: 'duration' },
    minDuration: { kind: 'min', column: 'duration' },
    maxDuration: { kind: 'max', column: 'duration' },
  }, qb => qb.where('timestamp', '>=', start).where('timestamp', '<=', end))

  return {
    averageDuration: Math.round(stats.averageDuration),
    minDuration: stats.minDuration,
    maxDuration: stats.maxDuration,
    totalJobs: stats.totalJobs,
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
  _startDate: Date | number,
  _endDate: Date | number,
): Promise<{
    totalPrints: number
    totalHours: number
    printsPerHour: number
    hourlyBreakdown: Array<{
      hour: number
      count: number
    }>
  }> {
  const start = typeof _startDate === 'number' ? _startDate : _startDate.getTime()
  const end = typeof _endDate === 'number' ? _endDate : _endDate.getTime()

  const receipts = await db
    .selectFrom('receipts')
    .where('timestamp', '>=', start)
    .where('timestamp', '<=', end)
    .selectAll()
    .execute()

  const totalPrints = receipts.length
  const totalHours = Math.ceil((end - start) / (1000 * 60 * 60))
  const printsPerHour = totalHours > 0 ? Math.round(totalPrints / totalHours) : 0

  const hourlyBreakdown = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: 0,
  }))

  receipts.forEach((receipt: any) => {
    const date = new Date(Number(receipt.timestamp))
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
