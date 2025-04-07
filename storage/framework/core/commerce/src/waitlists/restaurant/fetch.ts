import type { WaitlistRestaurantJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate, toTimestamp } from '@stacksjs/orm'

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
    .where('check_in_time', '>=', startDateStr)
    .where('check_in_time', '<=', endDateStr)
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

/**
 * Fetch all waiting entries with their quoted wait times
 * @returns Array of waiting entries with their quoted wait times
 */
export async function fetchWaitingWithQuotedTimes(): Promise<{
  entries: WaitlistRestaurantJsonResponse[]
  totalQuotedWaitTime: number
  averageQuotedWaitTime: number
}> {
  const waitingEntries = await db
    .selectFrom('waitlist_restaurants')
    .selectAll()
    .where('status', '=', 'waiting')
    .execute()

  const totalQuotedWaitTime = waitingEntries.reduce((sum, entry) => sum + (entry.quoted_wait_time ?? 0), 0)
  const averageQuotedWaitTime = waitingEntries.length > 0 ? totalQuotedWaitTime / waitingEntries.length : 0

  return {
    entries: waitingEntries,
    totalQuotedWaitTime,
    averageQuotedWaitTime,
  }
}

/**
 * Fetch all waiting entries with party size calculations
 * @returns Object containing waiting entries and party size statistics
 */
export async function fetchWaitingWithPartySizes(): Promise<{
  entries: WaitlistRestaurantJsonResponse[]
  totalPartySize: number
  averagePartySize: number
  partySizeBreakdown: Record<number, number>
}> {
  const waitingEntries = await db
    .selectFrom('waitlist_restaurants')
    .selectAll()
    .where('status', '=', 'waiting')
    .execute()

  const totalPartySize = waitingEntries.reduce((sum, entry) => sum + entry.party_size, 0)
  const averagePartySize = waitingEntries.length > 0 ? totalPartySize / waitingEntries.length : 0

  // Calculate breakdown of party sizes
  const partySizeBreakdown = waitingEntries.reduce((acc, entry) => {
    acc[entry.party_size] = (acc[entry.party_size] || 0) + 1
    return acc
  }, {} as Record<number, number>)

  return {
    entries: waitingEntries,
    totalPartySize,
    averagePartySize,
    partySizeBreakdown,
  }
}

/**
 * Fetch tables turned statistics for today
 * @returns Object containing tables turned statistics
 */
export async function fetchTablesTurnedToday(): Promise<{
  totalTablesTurned: number
  averagePartySize: number
  totalCustomersSeated: number
  breakdownByTablePreference: Record<string, number>
  breakdownByPartySize: Record<number, number>
}> {
  const today = new Date()
  const startOfDay = new Date(today)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(today)
  endOfDay.setHours(23, 59, 59, 999)

  const startDateStr = toTimestamp(startOfDay)
  const endDateStr = toTimestamp(endOfDay)

  // Fetch all seated entries for today
  const seatedEntries = await db
    .selectFrom('waitlist_restaurants')
    .selectAll()
    .where('status', '=', 'seated')
    .where('check_in_time', '>=', startDateStr)
    .where('check_in_time', '<=', endDateStr)
    .execute()

  // Calculate total tables turned
  const totalTablesTurned = seatedEntries.length

  // Calculate total customers seated
  const totalCustomersSeated = seatedEntries.reduce((sum, entry) => sum + entry.party_size, 0)

  // Calculate average party size
  const averagePartySize = totalTablesTurned > 0 ? totalCustomersSeated / totalTablesTurned : 0

  // Calculate breakdown by table preference
  const breakdownByTablePreference = seatedEntries.reduce((acc, entry) => {
    acc[entry.table_preference as string] = (acc[entry.table_preference as string] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Calculate breakdown by party size
  const breakdownByPartySize = seatedEntries.reduce((acc, entry) => {
    acc[entry.party_size] = (acc[entry.party_size] || 0) + 1
    return acc
  }, {} as Record<number, number>)

  return {
    totalTablesTurned,
    averagePartySize,
    totalCustomersSeated,
    breakdownByTablePreference,
    breakdownByPartySize,
  }
}

/**
 * Fetch seating rate statistics
 * @param startDate Start date for filtering entries
 * @param endDate End date for filtering entries
 * @returns Object containing seating rate and status breakdown
 */
export async function fetchSeatingRate(
  startDate: Date,
  endDate: Date,
): Promise<{
    totalEntries: number
    seatedEntries: number
    seatingRate: number
    statusBreakdown: Record<string, { count: number, percentage: number }>
  }> {
  const startDateStr = toTimestamp(startDate)
  const endDateStr = toTimestamp(endDate)

  const results = await db
    .selectFrom('waitlist_restaurants')
    .select([
      'status',
      eb => eb.fn.count<number>('id').as('count'),
    ])
    .where('check_in_time', '>=', startDateStr)
    .where('check_in_time', '<=', endDateStr)
    .groupBy('status')
    .execute()

  const totalEntries = results.reduce((sum, { count }) => sum + count, 0)
  const seatedCount = results.find(r => r.status === 'seated')?.count ?? 0

  const seatingRate = totalEntries > 0 ? (seatedCount / totalEntries) * 100 : 0

  const statusBreakdown = results.reduce((acc, { status, count }) => {
    acc[status as string] = {
      count,
      percentage: totalEntries > 0 ? (count / totalEntries) * 100 : 0,
    }
    return acc
  }, {} as Record<string, { count: number, percentage: number }>)

  return {
    totalEntries,
    seatedEntries: seatedCount,
    seatingRate,
    statusBreakdown,
  }
}

/**
 * Fetch no-show statistics
 * @param startDate Start date for filtering entries
 * @param endDate End date for filtering entries
 * @returns Object containing no-show statistics and related information
 */
export async function fetchNoShowStats(
  startDate: Date,
  endDate: Date,
): Promise<{
    totalNoShows: number
    noShowRate: number
    averageQuotedWaitTime: number
    averagePartySize: number
    breakdownByTablePreference: Record<string, number>
    breakdownByPartySize: Record<number, number>
  }> {
  const startDateStr = toTimestamp(startDate)
  const endDateStr = toTimestamp(endDate)

  // Build base query for no-show entries
  const noShowQuery = db
    .selectFrom('waitlist_restaurants')
    .selectAll()
    .where('status', '=', 'no_show')
    .where('check_in_time', '>=', startDateStr)
    .where('check_in_time', '<=', endDateStr)

  // Build base query for total entries
  const totalQuery = db
    .selectFrom('waitlist_restaurants')
    .select(eb => eb.fn.count<number>('id').as('count'))
    .where('check_in_time', '>=', startDateStr)
    .where('check_in_time', '<=', endDateStr)

  // Execute queries
  const noShowEntries = await noShowQuery.execute()
  const totalEntries = await totalQuery.executeTakeFirst()

  const totalNoShows = noShowEntries.length

  const noShowRate = totalEntries?.count && totalEntries.count > 0
    ? (totalNoShows / totalEntries.count) * 100
    : 0

  // Calculate average quoted wait time for no-shows
  const totalQuotedWaitTime = noShowEntries.reduce((sum, entry) => sum + (entry.quoted_wait_time ?? 0), 0)
  const averageQuotedWaitTime = totalNoShows > 0 ? totalQuotedWaitTime / totalNoShows : 0

  // Calculate average party size for no-shows
  const totalPartySize = noShowEntries.reduce((sum, entry) => sum + entry.party_size, 0)
  const averagePartySize = totalNoShows > 0 ? totalPartySize / totalNoShows : 0

  // Calculate breakdown by table preference
  const breakdownByTablePreference = noShowEntries.reduce((acc, entry) => {
    acc[entry.table_preference as string] = (acc[entry.table_preference as string] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Calculate breakdown by party size
  const breakdownByPartySize = noShowEntries.reduce((acc, entry) => {
    acc[entry.party_size] = (acc[entry.party_size] || 0) + 1
    return acc
  }, {} as Record<number, number>)

  return {
    totalNoShows,
    noShowRate,
    averageQuotedWaitTime,
    averagePartySize,
    breakdownByTablePreference,
    breakdownByPartySize,
  }
}

/**
 * Fetch current wait time statistics
 * @returns Object containing average quoted and actual wait times
 */
export async function fetchCurrentWaitTimes(): Promise<{
  averageQuoted: number
  averageActual: number
}> {
  const waitingEntries = await db
    .selectFrom('waitlist_restaurants')
    .select(['quoted_wait_time', 'actual_wait_time'])
    .where('status', '=', 'waiting')
    .execute()

  const totalQuoted = waitingEntries.reduce((sum, entry) => sum + (entry.quoted_wait_time || 0), 0)
  const totalActual = waitingEntries.reduce((sum, entry) => sum + (entry.actual_wait_time || 0), 0)
  const count = waitingEntries.length

  return {
    averageQuoted: count > 0 ? totalQuoted / count : 0,
    averageActual: count > 0 ? totalActual / count : 0,
  }
}

/**
 * Fetch seated statistics for the last 24 hours
 * @returns Object containing total seated count and hourly breakdown
 */
export async function fetchSeatedStats(): Promise<{
  total: number
  byHour: Array<{ hour: number, count: number }>
}> {
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000
  const seatedEntries = await db
    .selectFrom('waitlist_restaurants')
    .select(['seated_at'])
    .where('status', '=', 'seated')
    .where('seated_at', '>=', twentyFourHoursAgo)
    .execute()

  const byHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: seatedEntries.filter((entry) => {
      const entryHour = entry.seated_at

      return entryHour === hour
    }).length,
  }))

  return {
    total: seatedEntries.length,
    byHour,
  }
}

/**
 * Fetch time series statistics for all statuses
 * @returns Object containing daily counts for each status
 */
export async function fetchTimeSeriesStats(): Promise<Record<string, {
  total: number
  waiting: number
  seated: number
  cancelled: number
  no_show: number
}>> {
  const entries = await db
    .selectFrom('waitlist_restaurants')
    .select(['created_at', 'status'])
    .execute()

  return entries.reduce((acc, curr) => {
    const date = curr.created_at

    if (!acc[date!]) {
      acc[date!] = {
        total: 0,
        waiting: 0,
        seated: 0,
        cancelled: 0,
        no_show: 0,
      }
    }
    acc[date!].total++
    acc[date!][curr.status]++

    return acc
  }, {} as Record<string, {
    total: number
    waiting: number
    seated: number
    cancelled: number
    no_show: number
  }>)
}
