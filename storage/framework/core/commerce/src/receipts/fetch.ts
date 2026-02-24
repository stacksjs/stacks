import { db } from '@stacksjs/database'
type ReceiptJsonResponse = ModelRow<typeof Receipt>

/**
 * Fetch a print log by ID
 */
export async function fetchById(id: number): Promise<ReceiptJsonResponse | undefined> {
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

  const stats = await db
    .selectFrom('receipts')
    .where('timestamp', '>=', start)
    .where('timestamp', '<=', end)
    .select(((eb: any) => [
      eb.fn.count('id').as('total'),
      eb.fn.count('id').filterWhere('status', '=', 'success').as('success'),
      eb.fn.count('id').filterWhere('status', '=', 'failed').as('failed'),
      eb.fn.count('id').filterWhere('status', '=', 'warning').as('warning'),
      eb.fn.avg('size').as('averageSize'),
      eb.fn.avg('pages').as('averagePages'),
      eb.fn.avg('duration').as('averageDuration'),
    ]) as any)
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

  const stats = await db
    .selectFrom('receipts')
    .where('timestamp', '>=', start)
    .where('timestamp', '<=', end)
    .select(((eb: any) => [
      eb.fn.count('id').as('total'),
      eb.fn.count('id').filterWhere('status', '=', 'success').as('success'),
      eb.fn.count('id').filterWhere('status', '=', 'failed').as('failed'),
      eb.fn.count('id').filterWhere('status', '=', 'warning').as('warning'),
    ]) as any)
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
  _startDate: Date | number,
  _endDate: Date | number,
): Promise<{
    totalPages: number
    averagePagesPerReceipt: number
    totalReceipts: number
  }> {
  const start = typeof _startDate === 'number' ? _startDate : _startDate.getTime()
  const end = typeof _endDate === 'number' ? _endDate : _endDate.getTime()

  const stats = await db
    .selectFrom('receipts')
    .where('timestamp', '>=', start)
    .where('timestamp', '<=', end)
    .select(((eb: any) => [
      eb.fn.count('id').as('totalReceipts'),
      eb.fn.sum('pages').as('totalPages'),
      eb.fn.avg('pages').as('averagePagesPerReceipt'),
    ]) as any)
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

  const stats = await db
    .selectFrom('receipts')
    .where('timestamp', '>=', start)
    .where('timestamp', '<=', end)
    .select(((eb: any) => [
      eb.fn.count('id').as('totalJobs'),
      eb.fn.avg('duration').as('averageDuration'),
      eb.fn.min('duration').as('minDuration'),
      eb.fn.max('duration').as('maxDuration'),
    ]) as any)
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
