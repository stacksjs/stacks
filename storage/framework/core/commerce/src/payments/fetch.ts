import type { PaymentJsonResponse } from '@stacksjs/orm'
import { db, sql } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Payment statistics response interface
 */
export interface PaymentStats {
  total_transactions: number
  total_revenue: number
  average_transaction: number
  successful_rate: number
  comparison: {
    transactions: {
      difference: number
      percentage: number
      is_increase: boolean
    }
    revenue: {
      difference: number
      percentage: number
      is_increase: boolean
    }
    average: {
      difference: number
      percentage: number
      is_increase: boolean
    }
  }
}

export async function fetchAll(): Promise<PaymentJsonResponse[]> {
  return await db
    .selectFrom('payments')
    .selectAll()
    .execute()
}

export async function fetchById(id: number): Promise<PaymentJsonResponse | undefined> {
  return await db
    .selectFrom('payments')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

/**
 * Fetch payment statistics for a specific time period
 *
 * @param daysRange Number of days to look back (7, 30, 60, etc.)
 */
export async function fetchPaymentStats(daysRange: number = 30): Promise<PaymentStats> {
  const today = new Date()

  // Current period (last N days)
  const currentPeriodStart = new Date(today)
  currentPeriodStart.setDate(today.getDate() - daysRange)

  // Previous period (N days before the current period)
  const previousPeriodEnd = new Date(currentPeriodStart)
  previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1)

  const previousPeriodStart = new Date(previousPeriodEnd)
  previousPeriodStart.setDate(previousPeriodEnd.getDate() - daysRange)

  // Get current period stats for completed payments
  const currentStats = await db
    .selectFrom('payments')
    .select([
      db.fn.count('id').as('transaction_count'),
      db.fn.sum('amount').as('total_revenue'),
    ])
    .where('created_at', '>=', formatDate(currentPeriodStart))
    .where('created_at', '<=', formatDate(today))
    .where('status', '=', 'completed')
    .executeTakeFirst()

  // Get previous period stats for completed payments
  const previousStats = await db
    .selectFrom('payments')
    .select([
      db.fn.count('id').as('transaction_count'),
      db.fn.sum('amount').as('total_revenue'),
    ])
    .where('created_at', '>=', formatDate(previousPeriodStart))
    .where('created_at', '<=', formatDate(previousPeriodEnd))
    .where('status', '=', 'completed')
    .executeTakeFirst()

  // Get total transactions count (including non-completed ones) for calculating success rate
  const totalTransactions = await db
    .selectFrom('payments')
    .select(db.fn.count('id').as('count'))
    .where('created_at', '>=', formatDate(currentPeriodStart))
    .where('created_at', '<=', formatDate(today))
    .executeTakeFirst()

  // Calculate current period stats
  const currentTransactions = Number(currentStats?.transaction_count || 0)
  const currentRevenue = Number(currentStats?.total_revenue || 0)
  const currentAverage = currentTransactions > 0 ? currentRevenue / currentTransactions : 0

  // Calculate previous period stats
  const previousTransactions = Number(previousStats?.transaction_count || 0)
  const previousRevenue = Number(previousStats?.total_revenue || 0)
  const previousAverage = previousTransactions > 0 ? previousRevenue / previousTransactions : 0

  // Calculate differences
  const transactionDifference = currentTransactions - previousTransactions
  const revenueDifference = currentRevenue - previousRevenue
  const averageDifference = currentAverage - previousAverage

  // Calculate percentage changes
  const transactionPercentage = previousTransactions > 0
    ? (transactionDifference / previousTransactions) * 100
    : (currentTransactions > 0 ? 100 : 0)

  const revenuePercentage = previousRevenue > 0
    ? (revenueDifference / previousRevenue) * 100
    : (currentRevenue > 0 ? 100 : 0)

  const averagePercentage = previousAverage > 0
    ? (averageDifference / previousAverage) * 100
    : (currentAverage > 0 ? 100 : 0)

  // Calculate success rate
  const allTransactions = Number(totalTransactions?.count || 0)
  const successRate = allTransactions > 0
    ? (currentTransactions / allTransactions) * 100
    : 0

  return {
    total_transactions: currentTransactions,
    total_revenue: currentRevenue,
    average_transaction: currentAverage,
    successful_rate: successRate,
    comparison: {
      transactions: {
        difference: transactionDifference,
        percentage: Math.abs(transactionPercentage),
        is_increase: transactionDifference >= 0,
      },
      revenue: {
        difference: revenueDifference,
        percentage: Math.abs(revenuePercentage),
        is_increase: revenueDifference >= 0,
      },
      average: {
        difference: averageDifference,
        percentage: Math.abs(averagePercentage),
        is_increase: averageDifference >= 0,
      },
    },
  }
}

/**
 * Fetch payment statistics by payment method
 *
 * @param daysRange Number of days to look back
 */
export async function fetchPaymentStatsByMethod(daysRange: number = 30): Promise<Record<string, {
  count: number
  revenue: number
  percentage_of_total: number
}>> {
  const today = new Date()

  const startDate = new Date(today)
  startDate.setDate(today.getDate() - daysRange)

  // Get total stats for the period
  const totalStats = await db
    .selectFrom('payments')
    .select([
      db.fn.count('id').as('total_count'),
      db.fn.sum('amount').as('total_revenue'),
    ])
    .where('created_at', '>=', formatDate(startDate))
    .where('created_at', '<=', formatDate(today))
    .where('status', '=', 'completed')
    .executeTakeFirst()

  const totalCount = Number(totalStats?.total_count || 0)

  // Get stats grouped by payment method
  const methodStats = await db
    .selectFrom('payments')
    .select([
      'method',
      db.fn.count('id').as('count'),
      db.fn.sum('amount').as('revenue'),
    ])
    .where('created_at', '>=', formatDate(startDate))
    .where('created_at', '<=', formatDate(today))
    .where('status', '=', 'completed')
    .groupBy('method')
    .execute()

  // Format the results
  const result: Record<string, {
    count: number
    revenue: number
    percentage_of_total: number
  }> = {}

  methodStats.forEach((item) => {
    const count = Number(item.count || 0)
    const revenue = Number(item.revenue || 0)
    const percentageOfTotal = totalCount > 0 ? (count / totalCount) * 100 : 0

    result[item.method] = {
      count,
      revenue,
      percentage_of_total: percentageOfTotal,
    }
  })

  return result
}

/**
 * Fetch monthly payment trends for the last 12 months
 */
export async function fetchMonthlyPaymentTrends(): Promise<Array<{
  month: string
  year: number
  transactions: number
  revenue: number
  average: number
}>> {
  // Calculate date 12 months ago
  const today = new Date()

  const twelveMonthsAgo = new Date(today)
  twelveMonthsAgo.setMonth(today.getMonth() - 11)

  // Set to first day of that month
  twelveMonthsAgo.setDate(1)

  // Use SQLite's strftime function for date extraction
  const monthlyData = await db
    .selectFrom('payments')
    .select([
      sql`strftime('%Y', created_at)`.as('year'),
      sql`strftime('%m', created_at)`.as('month'),
      db.fn.count('id').as('transactions'),
      db.fn.sum('amount').as('revenue'),
    ])
    .where('created_at', '>=', formatDate(twelveMonthsAgo))
    .where('status', '=', 'completed')
    .groupBy(sql`strftime('%Y', created_at)`)
    .groupBy(sql`strftime('%m', created_at)`)
    .orderBy('year', 'asc')
    .orderBy('month', 'asc')
    .execute()

  // Format the results
  return monthlyData.map((item) => {
    const transactions = Number(item.transactions || 0)
    const revenue = Number(item.revenue || 0)
    const average = transactions > 0 ? revenue / transactions : 0

    // Format month name
    const monthIndex = Number(item.month) - 1 // Convert month to 0-based index
    const monthDate = new Date(Number(item.year), monthIndex, 1)
    const monthName = monthDate.toLocaleString('default', { month: 'short' })

    return {
      month: monthName,
      year: Number(item.year),
      transactions,
      revenue,
      average,
    }
  })
}
