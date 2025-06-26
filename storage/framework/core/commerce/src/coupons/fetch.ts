import type { CouponJsonResponse } from '@stacksjs/orm'
import type { CouponCountStats, CouponRedemptionStats, CouponStats, CouponTimeStats } from '../types'
import { db } from '@stacksjs/database'
import { extractDate } from '@stacksjs/orm'

/**
 * Process coupon data from the database
 * Parses JSON strings for applicable_products and applicable_categories
 */
function processCouponData(coupon: CouponJsonResponse): CouponJsonResponse {
  // Create a copy to avoid modifying the original object
  const processed = { ...coupon }

  processed.end_date = extractDate(new Date(processed.end_date))
  processed.start_date = extractDate(new Date(processed.start_date))

  // Convert is_active to boolean if needed
  if (processed.is_active !== undefined) {
    processed.is_active = Boolean(processed.is_active)
  }

  return processed
}

/**
 * Fetch all coupons from the database
 */
export async function fetchAll(): Promise<CouponJsonResponse[]> {
  const coupons = await db
    .selectFrom('coupons')
    .selectAll()
    .execute()

  return coupons.map(processCouponData)
}

/**
 * Fetch a coupon by ID
 */
export async function fetchById(id: number): Promise<CouponJsonResponse | undefined> {
  const coupon = await db
    .selectFrom('coupons')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  if (coupon) {
    return processCouponData(coupon)
  }

  return undefined
}

/**
 * Fetch a coupon by code
 */
export async function fetchByCode(code: string): Promise<CouponJsonResponse | undefined> {
  const coupon = await db
    .selectFrom('coupons')
    .where('code', '=', code)
    .selectAll()
    .executeTakeFirst()

  if (coupon) {
    return processCouponData(coupon)
  }

  return undefined
}

/**
 * Fetch active coupons (is_active = true and within date range)
 */
export async function fetchActive(): Promise<CouponJsonResponse[]> {
  const currentDate = formatDate(new Date())

  const coupons = await db
    .selectFrom('coupons')
    .where('is_active', '=', true)
    .where('start_date', '<=', currentDate)
    .where('end_date', '>=', currentDate)
    .selectAll()
    .execute()

  return coupons.map(processCouponData)
}

/**
 * Get coupon statistics
 */
export async function fetchStats(): Promise<CouponStats> {
  // Total coupons
  const totalCoupons = await db
    .selectFrom('coupons')
    .select(eb => eb.fn.count('id').as('count'))
    .executeTakeFirst()

  // Active coupons
  const currentDate = formatDate(new Date())
  const activeCoupons = await db
    .selectFrom('coupons')
    .where('is_active', '=', true)
    .where('start_date', '<=', currentDate)
    .where('end_date', '>=', currentDate)
    .select(eb => eb.fn.count('id').as('count'))
    .executeTakeFirst()

  // Coupons by discount type
  const couponsByType = await db
    .selectFrom('coupons')
    .select(['discount_type', eb => eb.fn.count('id').as('count')])
    .groupBy('discount_type')
    .execute()

  // Most used coupons
  const mostUsedCoupons = await db
    .selectFrom('coupons')
    .select(['id', 'code', 'discount_type', 'discount_value', 'usage_count'])
    .orderBy('usage_count', 'desc')
    .limit(5)
    .execute()

  // Upcoming coupons (active but not yet started)
  const upcomingCoupons = await db
    .selectFrom('coupons')
    .where('is_active', '=', true)
    .where('start_date', '>', currentDate)
    .select(['id', 'code', 'discount_type', 'discount_value', 'start_date', 'end_date'])
    .orderBy('start_date', 'asc')
    .limit(5)
    .execute()

  return {
    total: Number(totalCoupons?.count || 0),
    active: Number(activeCoupons?.count || 0),
    by_type: couponsByType,
    most_used: mostUsedCoupons,
    upcoming: upcomingCoupons,
  }
}

/**
 * Get count of active and inactive coupons for different time periods
 */
export async function fetchCouponCounts(): Promise<CouponTimeStats> {
  const currentDate = new Date()

  // Calculate start dates for different periods
  const weekStart = new Date(currentDate)
  weekStart.setDate(currentDate.getDate() - 7)

  const monthStart = new Date(currentDate)
  monthStart.setMonth(currentDate.getMonth() - 1)

  const yearStart = new Date(currentDate)
  yearStart.setFullYear(currentDate.getFullYear() - 1)

  // All-time counts
  const allTimeCounts = await fetchCountsForPeriod(null, null, currentDate)

  // Week counts
  const weekCounts = await fetchCountsForPeriod(weekStart, null, currentDate)

  // Month counts
  const monthCounts = await fetchCountsForPeriod(monthStart, null, currentDate)

  // Year counts
  const yearCounts = await fetchCountsForPeriod(yearStart, null, currentDate)

  return {
    week: weekCounts,
    month: monthCounts,
    year: yearCounts,
    all_time: allTimeCounts,
  }
}

/**
 * Helper function to fetch coupon counts for a specific time period
 *
 * @param startDate - Start of the period (or null for all time)
 * @param endDate - End of the period (or null for current date)
 * @param currentDate - Current date for active/inactive calculation
 */
async function fetchCountsForPeriod(
  startDate: Date | null,
  endDate: Date | null,
  currentDate: Date,
): Promise<CouponCountStats> {
  let query = db.selectFrom('coupons')

  // Apply date filter if startDate is provided
  if (startDate) {
    query = query.where('created_at', '>=', startDate.toISOString())
  }

  // Apply end date filter if endDate is provided
  if (endDate) {
    query = query.where('created_at', '<=', endDate.toISOString())
  }

  // Get total count
  const totalResult = await query
    .select(db.fn.count('id').as('count'))
    .executeTakeFirst()

  // Get active count (is_active = true, start_date <= current date, end_date >= current date)
  // Create a new query instead of cloning
  let activeQuery = db.selectFrom('coupons')

  // Apply the same date filters as the total query if needed
  if (startDate) {
    activeQuery = activeQuery.where('created_at', '>=', startDate.toISOString())
  }

  if (endDate) {
    activeQuery = activeQuery.where('created_at', '<=', endDate.toISOString())
  }

  // Add active coupon conditions
  activeQuery = activeQuery
    .where('is_active', '=', true)
    .where('start_date', '<=', currentDate)
    .where('end_date', '>=', currentDate)

  const activeResult = await activeQuery
    .select(db.fn.count('id').as('count'))
    .executeTakeFirst()

  // Calculate counts
  const total = Number(totalResult?.count || 0)
  const active = Number(activeResult?.count || 0)
  const inactive = total - active

  return {
    total,
    active,
    inactive,
  }
}

/**
 * Get detailed breakdown of active/inactive coupons by discount type
 */
export async function fetchCouponCountsByType(): Promise<Record<string, CouponCountStats>> {
  const currentDate = new Date()

  // Get all discount types
  const discountTypes = await db
    .selectFrom('coupons')
    .select('discount_type')
    .distinct()
    .execute()

  const result: Record<string, CouponCountStats> = {}

  // For each discount type, get the counts
  for (const { discount_type } of discountTypes) {
    // Base query for this discount type
    const query = db
      .selectFrom('coupons')
      .where('discount_type', '=', discount_type)

    // Total count for this type
    const totalResult = await query
      .select(db.fn.count('id').as('count'))
      .executeTakeFirst()

    // Active count for this type - create a new query instead of cloning
    const activeResult = await db
      .selectFrom('coupons')
      .where('discount_type', '=', discount_type)
      .where('is_active', '=', true)
      .where('start_date', '<=', currentDate)
      .where('end_date', '>=', currentDate)
      .select(db.fn.count('id').as('count'))
      .executeTakeFirst()

    const total = Number(totalResult?.count || 0)
    const active = Number(activeResult?.count || 0)

    result[discount_type] = {
      total,
      active,
      inactive: total - active,
    }
  }

  return result
}

/**
 * Fetch coupon redemption statistics based on usage_count
 */
export async function fetchRedemptionStats(): Promise<CouponRedemptionStats> {
  // Total redemptions (sum of all usage_count)
  const totalResult = await db
    .selectFrom('coupons')
    .select(db.fn.sum('usage_count').as('total'))
    .executeTakeFirst()

  const currentDate = new Date()

  // Calculate start dates for different periods
  const weekStart = new Date(currentDate)
  weekStart.setDate(currentDate.getDate() - 7)

  const monthStart = new Date(currentDate)
  monthStart.setMonth(currentDate.getMonth() - 1)

  const yearStart = new Date(currentDate)
  yearStart.setFullYear(currentDate.getFullYear() - 1)

  // Weekly redemptions (for coupons updated in the last week)
  const weekResult = await db
    .selectFrom('coupons')
    .where('updated_at', '>=', weekStart.toISOString())
    .select(db.fn.sum('usage_count').as('total'))
    .executeTakeFirst()

  // Monthly redemptions
  const monthResult = await db
    .selectFrom('coupons')
    .where('updated_at', '>=', monthStart.toISOString())
    .select(db.fn.sum('usage_count').as('total'))
    .executeTakeFirst()

  // Yearly redemptions
  const yearResult = await db
    .selectFrom('coupons')
    .where('updated_at', '>=', yearStart.toISOString())
    .select(db.fn.sum('usage_count').as('total'))
    .executeTakeFirst()

  // Redemptions by discount type
  const byTypeResults = await db
    .selectFrom('coupons')
    .select(['discount_type', db.fn.sum('usage_count').as('total')])
    .groupBy('discount_type')
    .execute()

  const byType: Record<string, number> = {}
  byTypeResults.forEach((item) => {
    byType[item.discount_type] = Number(item.total || 0)
  })

  return {
    total: Number(totalResult?.total || 0),
    week: Number(weekResult?.total || 0),
    month: Number(monthResult?.total || 0),
    year: Number(yearResult?.total || 0),
    by_type: byType,
  }
}

/**
 * Get top redeemed coupons
 */
export async function fetchTopRedeemedCoupons(limit: number = 5): Promise<any[]> {
  return await db
    .selectFrom('coupons')
    .select([
      'id',
      'code',
      'discount_type',
      'discount_value',
      'usage_count',
      'start_date',
      'end_date',
    ])
    .where('usage_count', '>', 0)
    .orderBy('usage_count', 'desc')
    .limit(limit)
    .execute()
}

/**
 * Get redemption trend data in a simplified manner
 */
export async function fetchRedemptionTrend(days: number = 30): Promise<any[]> {
  const endDate = new Date().toISOString()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Get coupons updated in the specified timeframe
  const coupons = await db
    .selectFrom('coupons')
    .select(['id', 'code', 'updated_at', 'usage_count'])
    .where('updated_at', '>=', startDate.toISOString())
    .where('updated_at', '<=', endDate)
    .where('usage_count', '>', 0)
    .orderBy('updated_at', 'desc')
    .execute()

  // Group by date (this is done in JS rather than SQL for simplicity)
  const trendData: Record<string, number> = {}

  coupons.forEach((coupon) => {
    // Format date as YYYY-MM-DD
    const dateString = coupon.updated_at
      ? new Date(coupon.updated_at).toISOString().split('T')[0]
      : 'unknown-date' // Fallback for undefined date

    // Add or increment the count for this date
    if (!trendData[dateString]) {
      trendData[dateString] = 0
    }
    trendData[dateString] += coupon?.usage_count || 0
  })

  // Convert to array format
  return Object.entries(trendData).map(([date, count]) => ({
    date,
    count,
  }))
}

/**
 * Get conversion rate (number of redemptions / number of active coupons)
 */
export async function fetchConversionRate(): Promise<{
  rate: number
  total_active: number
  total_redeemed: number
}> {
  const currentDate = new Date()

  // Get count of active coupons
  const activeResult = await db
    .selectFrom('coupons')
    .where('is_active', '=', true)
    .where('start_date', '<=', currentDate)
    .where('end_date', '>=', currentDate)
    .select(db.fn.count('id').as('count'))
    .executeTakeFirst()

  // Get count of coupons with usage > 0
  const redeemedResult = await db
    .selectFrom('coupons')
    .where('usage_count', '>', 0)
    .select(db.fn.count('id').as('count'))
    .executeTakeFirst()

  const totalActive = Number(activeResult?.count || 0)
  const totalRedeemed = Number(redeemedResult?.count || 0)

  // Calculate rate (avoid division by zero)
  const rate = totalActive > 0 ? (totalRedeemed / totalActive) * 100 : 0

  return {
    rate,
    total_active: totalActive,
    total_redeemed: totalRedeemed,
  }
}

/**
 * Calculate the month-over-month change in active coupons
 */
export async function getActiveCouponsMoMChange(): Promise<{
  current_month: number
  previous_month: number
  difference: number
  percentage_change: number
}> {
  const today = new Date()

  // Current month (start of current month to today)
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)

  // Previous month
  const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const previousMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)

  // Get active coupons for current month
  const currentMonthActive = await db
    .selectFrom('coupons')
    .select(db.fn.count('id').as('count'))
    .where('is_active', '=', true)
    .where('start_date', '<=', today)
    .where('end_date', '>=', currentMonthStart)
    .executeTakeFirst()

  // Get active coupons for previous month
  const previousMonthActive = await db
    .selectFrom('coupons')
    .select(db.fn.count('id').as('count'))
    .where('is_active', '=', true)
    .where('start_date', '<=', previousMonthEnd)
    .where('end_date', '>=', previousMonthStart)
    .executeTakeFirst()

  const currentCount = Number(currentMonthActive?.count || 0)
  const previousCount = Number(previousMonthActive?.count || 0)
  const difference = currentCount - previousCount

  // Calculate percentage change, handling division by zero
  const percentageChange = previousCount !== 0
    ? (difference / previousCount) * 100
    : (currentCount > 0 ? 100 : 0) // If previous month was 0, and current is > 0, that's a 100% increase

  return {
    current_month: currentCount,
    previous_month: previousCount,
    difference,
    percentage_change: percentageChange,
  }
}
