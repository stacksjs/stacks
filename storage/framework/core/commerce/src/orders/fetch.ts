import type {
  OrderResponse,
  OrderStats,
  OrderType,
  OrderTypeCount,
  StatusCount,
} from '../../types'
import { db } from '@stacksjs/database'

export interface FetchOrdersOptions {
  page?: number
  limit?: number
  search?: string
  status?: string
  order_type?: string
  customer_id?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  from_date?: string
  to_date?: string
}

/**
 * Fetch all orders from the database with their items
 */
export async function fetchAll(): Promise<OrderType[]> {
  const orders = await db
    .selectFrom('orders')
    .selectAll()
    .execute()

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
 * Fetch an order by ID
 */
export async function fetchById(id: number): Promise<OrderType | undefined> {
  const order = await db
    .selectFrom('orders')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

  return order
}

/**
 * Fetch orders for a specific customer
 */
export async function fetchByCustomer(customerId: number, options: FetchOrdersOptions = {}): Promise<OrderResponse> {
  return fetchPaginated({
    ...options,
    customer_id: customerId,
  })
}

/**
 * Fetch orders by status
 */
export async function fetchByStatus(status: string, options: FetchOrdersOptions = {}): Promise<OrderResponse> {
  return fetchPaginated({
    ...options,
    status,
  })
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
