import type { WaitlistProductJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate, toTimestamp } from '@stacksjs/orm'

/**
 * Fetch a waitlist product by ID
 */
export async function fetchById(id: number): Promise<WaitlistProductJsonResponse | undefined> {
  return await db
    .selectFrom('waitlist_products')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all waitlist products
 */
export async function fetchAll(): Promise<WaitlistProductJsonResponse[]> {
  return await db.selectFrom('waitlist_products').selectAll().execute()
}

/**
 * Fetch the count of waitlist products grouped by source
 * @param startDate Optional start date to filter by
 * @param endDate Optional end date to filter by
 * @returns An object containing the count for each source
 */
export async function fetchCountBySource(
  startDate?: Date,
  endDate?: Date,
): Promise<Record<string, number>> {
  let query = db
    .selectFrom('waitlist_products')
    .select([
      'source',
      eb => eb.fn.count<number>('id').as('count'),
    ])
    .groupBy('source')

  if (startDate && endDate) {
    const startDateStr = formatDate(startDate)
    const endDateStr = formatDate(endDate)
    query = query
      .where('created_at', '>=', startDateStr)
      .where('created_at', '<=', endDateStr)
  }

  const results = await query.execute()

  return results.reduce((acc, { source, count }) => {
    acc[source] = count
    return acc
  }, {} as Record<string, number>)
}

/**
 * Fetch the count of waitlist products for a specific date
 * @param date The date to count entries for (defaults to today)
 * @returns The count of entries for the specified date
 */
export async function fetchCountByDate(date: Date = new Date()): Promise<number> {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const startDateStr = formatDate(startOfDay)
  const endDateStr = formatDate(endOfDay)

  const result = await db
    .selectFrom('waitlist_products')
    .select(eb => eb.fn.count<number>('id').as('count'))
    .where('created_at', '>=', startDateStr)
    .where('created_at', '<=', endDateStr)
    .executeTakeFirst()

  return result?.count ?? 0
}

/**
 * Fetch the count of waitlist products with a specific quantity
 * @param quantity The quantity to count orders for
 * @returns The count of orders with the specified quantity
 */
export async function fetchCountByQuantity(quantity: number): Promise<number> {
  const result = await db
    .selectFrom('waitlist_products')
    .select(eb => eb.fn.count<number>('id').as('count'))
    .where('party_size', '=', quantity)
    .executeTakeFirst()

  return result?.count ?? 0
}

/**
 * Fetch the count of waitlist products grouped by quantity
 * @param startDate Optional start date to filter by
 * @param endDate Optional end date to filter by
 * @returns An object containing the count for each quantity
 */
export async function fetchCountByAllQuantities(
  startDate?: Date,
  endDate?: Date,
): Promise<Record<number, number>> {
  let query = db
    .selectFrom('waitlist_products')
    .select([
      'quantity',
      eb => eb.fn.count<number>('id').as('count'),
    ])
    .groupBy('quantity')

  if (startDate && endDate) {
    const startDateStr = formatDate(startDate)
    const endDateStr = formatDate(endDate)
    query = query
      .where('created_at', '>=', startDateStr)
      .where('created_at', '<=', endDateStr)
  }

  const results = await query.execute()

  return results.reduce((acc, { quantity, count }) => {
    acc[quantity] = count
    return acc
  }, {} as Record<number, number>)
}

/**
 * Fetch waitlist products between two dates
 * @param startDate The start date of the range
 * @param endDate The end date of the range
 * @returns Array of waitlist products within the date range
 */
export async function fetchBetweenDates(
  startDate: Date,
  endDate: Date,
): Promise<WaitlistProductJsonResponse[]> {
  const startDateStr = formatDate(startDate)
  const endDateStr = formatDate(endDate)

  return await db
    .selectFrom('waitlist_products')
    .selectAll()
    .where('created_at', '>=', startDateStr)
    .where('created_at', '<=', endDateStr)
    .execute()
}

/**
 * Fetch waitlist products that were notified between two dates
 * @param startDate The start date of the range
 * @param endDate The end date of the range
 * @returns Array of waitlist products that were notified within the date range
 */
export async function fetchNotifiedBetweenDates(
  startDate: Date,
  endDate: Date,
): Promise<WaitlistProductJsonResponse[]> {
  const startDateStr = toTimestamp(startDate)
  const endDateStr = toTimestamp(endDate)

  return await db
    .selectFrom('waitlist_products')
    .selectAll()
    .where('notified_at', '>=', startDateStr)
    .where('notified_at', '<=', endDateStr)
    .where('notified_at', 'is not', null)
    .execute()
}

/**
 * Fetch waitlist products that were purchased between two dates
 * @param startDate The start date of the range
 * @param endDate The end date of the range
 * @returns Array of waitlist products that were purchased within the date range
 */
export async function fetchPurchasedBetweenDates(
  startDate: Date,
  endDate: Date,
): Promise<WaitlistProductJsonResponse[]> {
  const startDateStr = toTimestamp(startDate)
  const endDateStr = toTimestamp(endDate)

  return await db
    .selectFrom('waitlist_products')
    .selectAll()
    .where('purchased_at', '>=', startDateStr)
    .where('purchased_at', '<=', endDateStr)
    .where('purchased_at', 'is not', null)
    .execute()
}

/**
 * Fetch waitlist products that were cancelled between two dates
 * @param startDate The start date of the range
 * @param endDate The end date of the range
 * @returns Array of waitlist products that were cancelled within the date range
 */
export async function fetchCancelledBetweenDates(
  startDate: Date,
  endDate: Date,
): Promise<WaitlistProductJsonResponse[]> {
  const startDateStr = toTimestamp(startDate)
  const endDateStr = toTimestamp(endDate)

  return await db
    .selectFrom('waitlist_products')
    .selectAll()
    .where('cancelled_at', '>=', startDateStr)
    .where('cancelled_at', '<=', endDateStr)
    .where('cancelled_at', 'is not', null)
    .execute()
}

/**
 * Fetch all waitlist products with waiting status
 * @returns Array of waitlist products with waiting status
 */
export async function fetchWaiting(): Promise<WaitlistProductJsonResponse[]> {
  return await db
    .selectFrom('waitlist_products')
    .selectAll()
    .where('status', '=', 'waiting')
    .execute()
}

/**
 * Fetch the count of waitlist products by status
 * @param status The status to filter by
 * @param startDate Optional start date to filter by
 * @param endDate Optional end date to filter by
 * @returns The count of waitlist products with the specified status
 */
export async function fetchCountByStatus(
  status: string,
  startDate?: Date,
  endDate?: Date,
): Promise<number> {
  let query = db
    .selectFrom('waitlist_products')
    .select(eb => eb.fn.count<number>('id').as('count'))
    .where('status', '=', status)

  if (startDate && endDate) {
    const startDateStr = formatDate(startDate)
    const endDateStr = formatDate(endDate)
    query = query
      .where('created_at', '>=', startDateStr)
      .where('created_at', '<=', endDateStr)
  }

  const result = await query.executeTakeFirst()
  return result?.count ?? 0
}

/**
 * Fetch conversion rates for waitlist products
 * @param startDate Optional start date to filter by
 * @param endDate Optional end date to filter by
 * @returns Object containing total conversion rate and breakdown by status
 */
export async function fetchConversionRates(
  startDate?: Date,
  endDate?: Date,
): Promise<{
    totalConversionRate: number
    statusBreakdown: Record<string, { count: number, percentage: number }>
  }> {
  let query = db
    .selectFrom('waitlist_products')
    .select([
      'status',
      eb => eb.fn.count<number>('id').as('count'),
    ])
    .groupBy('status')

  if (startDate && endDate) {
    const startDateStr = formatDate(startDate)
    const endDateStr = formatDate(endDate)
    query = query
      .where('created_at', '>=', startDateStr)
      .where('created_at', '<=', endDateStr)
  }

  const results = await query.execute()

  // Calculate total count and purchased count
  const totalCount = results.reduce((sum, { count }) => sum + count, 0)
  const purchasedCount = results.find(r => r.status === 'purchased')?.count ?? 0

  // Calculate conversion rate
  const totalConversionRate = totalCount > 0 ? (purchasedCount / totalCount) * 100 : 0

  // Create status breakdown with percentages
  const statusBreakdown = results.reduce((acc, { status, count }) => {
    acc[status as string] = {
      count,
      percentage: totalCount > 0 ? (count / totalCount) * 100 : 0,
    }
    return acc
  }, {} as Record<string, { count: number, percentage: number }>)

  return {
    totalConversionRate,
    statusBreakdown,
  }
}

/**
 * Fetch the count of waitlist products between two dates
 * @param startDate The start date of the range
 * @param endDate The end date of the range
 * @returns The count of waitlist products within the date range
 */
export async function fetchCountBetweenDates(
  startDate: Date,
  endDate: Date,
): Promise<number> {
  const startDateStr = formatDate(startDate)
  const endDateStr = formatDate(endDate)

  const result = await db
    .selectFrom('waitlist_products')
    .select(eb => eb.fn.count<number>('id').as('count'))
    .where('created_at', '>=', startDateStr)
    .where('created_at', '<=', endDateStr)
    .executeTakeFirst()

  return result?.count ?? 0
}

/**
 * Fetch the count of waitlist products grouped by date
 * @param startDate Optional start date to filter by
 * @param endDate Optional end date to filter by
 * @returns An array of objects containing date and count
 */
export async function fetchCountByDateGrouped(
  startDate?: Date,
  endDate?: Date,
): Promise<{ date: string, count: number }[]> {
  let query = db
    .selectFrom('waitlist_products')
    .select(['created_at'])

  if (startDate && endDate) {
    const startDateStr = formatDate(startDate)
    const endDateStr = formatDate(endDate)
    query = query
      .where('created_at', '>=', startDateStr)
      .where('created_at', '<=', endDateStr)
  }

  const results = await query.execute()

  // Group by date and count
  const dateCounts = results.reduce((acc, { created_at }) => {
    const date = created_at!.split('T')[0] // Get YYYY-MM-DD
    acc[date] = (acc[date] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Convert to array and sort by date
  return Object.entries(dateCounts)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
