import type { OrderJsonResponse } from '@stacksjs/orm'
import type {
  OrderStats,
  OrderTypeCount,
  StatusCount,
} from '../types'
import { db } from '@stacksjs/database'

/**
 * Fetch all orders from the database with their items
 * @param limit Optional limit on number of orders to fetch
 */
export async function fetchAll(limit?: number): Promise<OrderJsonResponse[]> {
  let query = db
    .selectFrom('orders')
    .selectAll()
    .orderBy('created_at', 'desc')

  if (limit) {
    query = query.limit(limit)
  }

  const orders = await query.execute()

  // Fetch items for each order
  return await Promise.all(orders.map(async (order) => {
    const items = await db
      .selectFrom('order_items')
      .where('order_id', '=', order.id)
      .selectAll()
      .execute()

    return {
      ...order,
      items,
    }
  }))
}

/**
 * Fetch the most recent orders
 * @param limit Number of recent orders to fetch (default: 10)
 */
export async function fetchRecent(limit: number = 10): Promise<OrderJsonResponse[]> {
  return fetchAll(limit)
}

/**
 * Fetch an order by ID
 */
export async function fetchById(id: number): Promise<OrderJsonResponse | undefined> {
  const order = await db
    .selectFrom('orders')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  return order
}

/**
 * Get order statistics
 */
export async function fetchStats(): Promise<OrderStats> {
  // Total orders
  const totalOrders = await db
    .selectFrom('orders')
    .select(eb => eb.fn.count('id').as('count'))
    .executeTakeFirst()

  // Orders by status
  const ordersByStatus = await db
    .selectFrom('orders')
    .select(['status', eb => eb.fn.count('id').as('count')])
    .groupBy('status')
    .execute() as StatusCount[]

  // Orders by type
  const ordersByType = await db
    .selectFrom('orders')
    .select(['order_type', eb => eb.fn.count('id').as('count')])
    .groupBy('order_type')
    .execute() as OrderTypeCount[]

  // Recent orders with their items
  const recentOrdersRaw = await db
    .selectFrom('orders')
    .selectAll()
    .orderBy('created_at', 'desc')
    .limit(5)
    .execute()

  // Fetch items for each recent order
  const recentOrders = await Promise.all(recentOrdersRaw.map(async (order) => {
    const items = await db
      .selectFrom('order_items')
      .where('order_id', '=', order.id)
      .selectAll()
      .execute()

    return {
      ...order,
      items,
    }
  }))

  // Total revenue
  const revenue = await db
    .selectFrom('orders')
    .select(eb => eb.fn.sum('total_amount').as('total'))
    .executeTakeFirst()

  return {
    total: Number(totalOrders?.count || 0),
    by_status: ordersByStatus,
    by_type: ordersByType,
    recent: recentOrders,
    revenue: Number(revenue?.total || 0),
  }
}

/**
 * Compare orders between different time periods
 * @param daysRange Number of days to look back (7, 30, 60, etc.)
 */
export async function compareOrdersByPeriod(daysRange: number = 30): Promise<{
  current_period: number
  previous_period: number
  difference: number
  percentage_change: number
  days_range: number
}> {
  const today = new Date()

  // Current period (last N days)
  const currentPeriodStart = new Date(today)
  currentPeriodStart.setDate(today.getDate() - daysRange)

  // Previous period (N days before the current period)
  const previousPeriodEnd = new Date(currentPeriodStart)
  previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1)

  const previousPeriodStart = new Date(previousPeriodEnd)
  previousPeriodStart.setDate(previousPeriodEnd.getDate() - daysRange)

  // Get orders for current period
  const currentPeriodOrders = await db
    .selectFrom('orders')
    .select(db.fn.count('id').as('count'))
    .where('created_at', '>=', currentPeriodStart.toISOString())
    .where('created_at', '<=', today.toISOString())
    .executeTakeFirst()

  // Get orders for previous period
  const previousPeriodOrders = await db
    .selectFrom('orders')
    .select(db.fn.count('id').as('count'))
    .where('created_at', '>=', previousPeriodStart.toISOString())
    .where('created_at', '<=', previousPeriodEnd.toISOString())
    .executeTakeFirst()

  const currentCount = Number(currentPeriodOrders?.count || 0)
  const previousCount = Number(previousPeriodOrders?.count || 0)
  const difference = currentCount - previousCount

  // Calculate percentage change, handling division by zero
  const percentageChange = previousCount !== 0
    ? (difference / previousCount) * 100
    : (currentCount > 0 ? 100 : 0)

  return {
    current_period: currentCount,
    previous_period: previousCount,
    difference,
    percentage_change: percentageChange,
    days_range: daysRange,
  }
}

/**
 * Calculate order values and metrics for different time periods
 * @param daysRange Number of days to look back (7, 30, 60, etc.)
 */
export async function calculateOrderMetrics(daysRange: number = 30): Promise<{
  current_period: {
    total_orders: number
    total_revenue: number
    average_order_value: number
    orders_by_status: { status: string, count: number }[]
    orders_by_type: { order_type: string, count: number }[]
  }
  previous_period: {
    total_orders: number
    total_revenue: number
    average_order_value: number
  }
  comparison: {
    orders: {
      difference: number
      percentage: number
      is_increase: boolean
    }
    revenue: {
      difference: number
      percentage: number
      is_increase: boolean
    }
    average_order_value: {
      difference: number
      percentage: number
      is_increase: boolean
    }
  }
  days_range: number
}> {
  const today = new Date()

  // Current period (last N days)
  const currentPeriodStart = new Date(today)
  currentPeriodStart.setDate(today.getDate() - daysRange)

  // Previous period (N days before the current period)
  const previousPeriodEnd = new Date(currentPeriodStart)
  previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1)

  const previousPeriodStart = new Date(previousPeriodEnd)
  previousPeriodStart.setDate(previousPeriodEnd.getDate() - daysRange)

  // Get values for current period
  const currentPeriodValues = await db
    .selectFrom('orders')
    .select([
      db.fn.count('id').as('total_orders'),
      db.fn.sum('total_amount').as('total_revenue'),
    ])
    .where('created_at', '>=', currentPeriodStart.toISOString())
    .where('created_at', '<=', today.toISOString())
    .executeTakeFirst()

  // Get values for previous period
  const previousPeriodValues = await db
    .selectFrom('orders')
    .select([
      db.fn.count('id').as('total_orders'),
      db.fn.sum('total_amount').as('total_revenue'),
    ])
    .where('created_at', '>=', previousPeriodStart.toISOString())
    .where('created_at', '<=', previousPeriodEnd.toISOString())
    .executeTakeFirst()

  // Get orders by status for current period
  const ordersByStatus = await db
    .selectFrom('orders')
    .select(['status', db.fn.count('id').as('count')])
    .where('created_at', '>=', currentPeriodStart.toISOString())
    .where('created_at', '<=', today.toISOString())
    .groupBy('status')
    .execute()

  // Get orders by type for current period
  const ordersByType = await db
    .selectFrom('orders')
    .select(['order_type', db.fn.count('id').as('count')])
    .where('created_at', '>=', currentPeriodStart.toISOString())
    .where('created_at', '<=', today.toISOString())
    .groupBy('order_type')
    .execute()

  // Calculate values for current period
  const currentTotalOrders = Number(currentPeriodValues?.total_orders || 0)
  const currentTotalRevenue = Number(currentPeriodValues?.total_revenue || 0)
  const currentAverageOrderValue = currentTotalOrders > 0
    ? currentTotalRevenue / currentTotalOrders
    : 0

  // Calculate values for previous period
  const previousTotalOrders = Number(previousPeriodValues?.total_orders || 0)
  const previousTotalRevenue = Number(previousPeriodValues?.total_revenue || 0)
  const previousAverageOrderValue = previousTotalOrders > 0
    ? previousTotalRevenue / previousTotalOrders
    : 0

  // Calculate differences
  const ordersDifference = currentTotalOrders - previousTotalOrders
  const revenueDifference = currentTotalRevenue - previousTotalRevenue
  const aovDifference = currentAverageOrderValue - previousAverageOrderValue

  // Calculate percentage changes
  const ordersPercentageChange = previousTotalOrders !== 0
    ? (ordersDifference / previousTotalOrders) * 100
    : (currentTotalOrders > 0 ? 100 : 0)

  const revenuePercentageChange = previousTotalRevenue !== 0
    ? (revenueDifference / previousTotalRevenue) * 100
    : (currentTotalRevenue > 0 ? 100 : 0)

  const aovPercentageChange = previousAverageOrderValue !== 0
    ? (aovDifference / previousAverageOrderValue) * 100
    : (currentAverageOrderValue > 0 ? 100 : 0)

  return {
    current_period: {
      total_orders: currentTotalOrders,
      total_revenue: currentTotalRevenue,
      average_order_value: currentAverageOrderValue,
      orders_by_status: ordersByStatus.map(item => ({
        status: item.status,
        count: Number(item.count),
      })),
      orders_by_type: ordersByType.map(item => ({
        order_type: item.order_type,
        count: Number(item.count),
      })),
    },
    previous_period: {
      total_orders: previousTotalOrders,
      total_revenue: previousTotalRevenue,
      average_order_value: previousAverageOrderValue,
    },
    comparison: {
      orders: {
        difference: ordersDifference,
        percentage: Math.abs(ordersPercentageChange),
        is_increase: ordersDifference >= 0,
      },
      revenue: {
        difference: revenueDifference,
        percentage: Math.abs(revenuePercentageChange),
        is_increase: revenueDifference >= 0,
      },
      average_order_value: {
        difference: aovDifference,
        percentage: Math.abs(aovPercentageChange),
        is_increase: aovDifference >= 0,
      },
    },
    days_range: daysRange,
  }
}

/**
 * Get daily order counts for a time period
 * @param daysRange Number of days to look back
 */
export async function fetchDailyOrderTrends(daysRange: number = 30): Promise<{
  date: string
  order_count: number
  revenue: number
}[]> {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - daysRange)

  // Query to get daily order counts and revenue
  const dailyOrders = await db
    .selectFrom('orders')
    .select([
      db.fn.count('id').as('order_count'),
      db.fn.sum('total_amount').as('revenue'),
      // Extract just the date part in ISO format (YYYY-MM-DD)
      'created_at',
    ])
    .where('created_at', '>=', startDate.toISOString())
    .where('created_at', '<=', today.toISOString())
    .groupBy('created_at')
    .orderBy('created_at', 'asc')
    .execute()

  return dailyOrders.map(day => ({
    date: day.created_at!,
    order_count: Number(day.order_count || 0),
    revenue: Number(day.revenue || 0),
  }))
}
