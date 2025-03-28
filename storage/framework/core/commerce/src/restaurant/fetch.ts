import type { WaitlistRestaurantJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Fetch a restaurant waitlist entry by ID
 */
export async function fetchById(id: number): Promise<WaitlistRestaurantJsonResponse | undefined> {
  return await db
    .selectFrom('waitlist_restaurants')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all restaurant waitlist entries
 */
export async function fetchAll(): Promise<WaitlistRestaurantJsonResponse[]> {
  return await db.selectFrom('waitlist_restaurants').selectAll().execute()
}

/**
 * Fetch the count of restaurant waitlist entries grouped by table preference
 * @returns An object containing the count for each table preference
 */
export async function fetchCountByTablePreference(): Promise<Record<string, number>> {
  const results = await db
    .selectFrom('waitlist_restaurants')
    .select([
      'table_preference',
      eb => eb.fn.count<number>('id').as('count'),
    ])
    .groupBy('table_preference')
    .execute()

  return results.reduce((acc, { table_preference, count }) => {
    acc[table_preference as string] = count
    return acc
  }, {} as Record<string, number>)
}

/**
 * Fetch the count of restaurant waitlist entries for a specific date
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
    .selectFrom('waitlist_restaurants')
    .select(eb => eb.fn.count<number>('id').as('count'))
    .where('created_at', '>=', startDateStr)
    .where('created_at', '<=', endDateStr)
    .executeTakeFirst()

  return result?.count ?? 0
}

/**
 * Fetch the count of restaurant waitlist entries with a specific party size
 * @param partySize The party size to count entries for
 * @returns The count of entries with the specified party size
 */
export async function fetchCountByPartySize(partySize: number): Promise<number> {
  const result = await db
    .selectFrom('waitlist_restaurants')
    .select(eb => eb.fn.count<number>('id').as('count'))
    .where('party_size', '=', partySize)
    .executeTakeFirst()

  return result?.count ?? 0
}

/**
 * Fetch the count of restaurant waitlist entries grouped by party size
 * @returns An object containing the count for each party size
 */
export async function fetchCountByAllPartySizes(): Promise<Record<number, number>> {
  const results = await db
    .selectFrom('waitlist_restaurants')
    .select([
      'party_size',
      eb => eb.fn.count<number>('id').as('count'),
    ])
    .groupBy('party_size')
    .execute()

  return results.reduce((acc, { party_size, count }) => {
    acc[party_size] = count
    return acc
  }, {} as Record<number, number>)
}

/**
 * Fetch restaurant waitlist entries between two dates
 * @param startDate The start date of the range
 * @param endDate The end date of the range
 * @returns Array of waitlist entries within the date range
 */
export async function fetchBetweenDates(
  startDate: Date,
  endDate: Date,
): Promise<WaitlistRestaurantJsonResponse[]> {
  const startDateStr = formatDate(startDate)
  const endDateStr = formatDate(endDate)

  return await db
    .selectFrom('waitlist_restaurants')
    .selectAll()
    .where('created_at', '>=', startDateStr)
    .where('created_at', '<=', endDateStr)
    .execute()
}

/**
 * Fetch restaurant waitlist entries that were seated between two dates
 * @param startDate The start date of the range
 * @param endDate The end date of the range
 * @returns Array of waitlist entries that were seated within the date range
 */
export async function fetchSeatedBetweenDates(
  startDate: Date,
  endDate: Date,
): Promise<WaitlistRestaurantJsonResponse[]> {
  const startDateStr = formatDate(startDate)
  const endDateStr = formatDate(endDate)

  return await db
    .selectFrom('waitlist_restaurants')
    .selectAll()
    .where('updated_at', '>=', startDateStr)
    .where('updated_at', '<=', endDateStr)
    .where('status', '=', 'seated')
    .execute()
}

/**
 * Fetch all restaurant waitlist entries with waiting status
 * @returns Array of waitlist entries with waiting status
 */
export async function fetchWaiting(): Promise<WaitlistRestaurantJsonResponse[]> {
  return await db
    .selectFrom('waitlist_restaurants')
    .selectAll()
    .where('status', '=', 'waiting')
    .execute()
}

/**
 * Fetch conversion rates for restaurant waitlist entries
 * @returns Object containing total conversion rate and breakdown by status
 */
export async function fetchConversionRates(): Promise<{
  totalConversionRate: number
  statusBreakdown: Record<string, { count: number, percentage: number }>
}> {
  const results = await db
    .selectFrom('waitlist_restaurants')
    .select([
      'status',
      eb => eb.fn.count<number>('id').as('count'),
    ])
    .groupBy('status')
    .execute()

  const totalCount = results.reduce((sum, { count }) => sum + count, 0)
  const seatedCount = results.find(r => r.status === 'seated')?.count ?? 0

  const totalConversionRate = totalCount > 0 ? (seatedCount / totalCount) * 100 : 0

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
 * Fetch average wait times for restaurant waitlist entries
 * @returns Object containing average quoted and actual wait times
 */
export async function fetchAverageWaitTimes(): Promise<{
  averageQuotedWaitTime: number
  averageActualWaitTime: number
}> {
  const result = await db
    .selectFrom('waitlist_restaurants')
    .select([
      eb => eb.fn.avg<number>('quoted_wait_time').as('avg_quoted_wait_time'),
      eb => eb.fn.avg<number>('actual_wait_time').as('avg_actual_wait_time'),
    ])
    .executeTakeFirst()

  return {
    averageQuotedWaitTime: result?.avg_quoted_wait_time ?? 0,
    averageActualWaitTime: result?.avg_actual_wait_time ?? 0,
  }
}
