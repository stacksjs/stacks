import type { WaitlistProductJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Fetch a waitlist product by ID
 */
export async function fetchById(id: number): Promise<WaitlistProductJsonResponse | undefined> {
  return await db
    .selectFrom('wait_list_products')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all waitlist products
 */
export async function fetchAll(): Promise<WaitlistProductJsonResponse[]> {
  return await db.selectFrom('wait_list_products').selectAll().execute()
}

/**
 * Fetch the count of waitlist products grouped by source
 * @returns An object containing the count for each source
 */
export async function fetchCountBySource(): Promise<Record<string, number>> {
  const results = await db
    .selectFrom('wait_list_products')
    .select([
      'source',
      eb => eb.fn.count<number>('id').as('count'),
    ])
    .groupBy('source')
    .execute()

  // Convert array to object with source as key and count as value
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
    .selectFrom('wait_list_products')
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
    .selectFrom('wait_list_products')
    .select(eb => eb.fn.count<number>('id').as('count'))
    .where('party_size', '=', quantity)
    .executeTakeFirst()

  return result?.count ?? 0
}

/**
 * Fetch the count of waitlist products grouped by quantity
 * @returns An object containing the count for each quantity
 */
export async function fetchCountByAllQuantities(): Promise<Record<number, number>> {
  const results = await db
    .selectFrom('wait_list_products')
    .select([
      'party_size',
      eb => eb.fn.count<number>('id').as('count'),
    ])
    .groupBy('party_size')
    .execute()

  // Convert array to object with quantity as key and count as value
  return results.reduce((acc, { party_size, count }) => {
    acc[party_size] = count
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
    .selectFrom('wait_list_products')
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
  const startDateStr = formatDate(startDate)
  const endDateStr = formatDate(endDate)

  return await db
    .selectFrom('wait_list_products')
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
  const startDateStr = formatDate(startDate)
  const endDateStr = formatDate(endDate)

  return await db
    .selectFrom('wait_list_products')
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
  const startDateStr = formatDate(startDate)
  const endDateStr = formatDate(endDate)

  return await db
    .selectFrom('wait_list_products')
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
    .selectFrom('wait_list_products')
    .selectAll()
    .where('status', '=', 'waiting')
    .execute()
}

/**
 * Fetch conversion rates for waitlist products
 * @returns Object containing total conversion rate and breakdown by status
 */
export async function fetchConversionRates(): Promise<{
  totalConversionRate: number
  statusBreakdown: Record<string, { count: number; percentage: number }>
}> {
  const results = await db
    .selectFrom('wait_list_products')
    .select([
      'status',
      eb => eb.fn.count<number>('id').as('count'),
    ])
    .groupBy('status')
    .execute()

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
  }, {} as Record<string, { count: number; percentage: number }>)

  return {
    totalConversionRate,
    statusBreakdown,
  }
}
