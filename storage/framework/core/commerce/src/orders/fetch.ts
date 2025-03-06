import type {
  OrderJsonResponse,
  OrderResponse,
  OrderStats,
  OrderType,
  OrderTypeCount,
  StatusCount,
} from '../../types'
import { db } from '@stacksjs/database'
import { handleError } from '@stacksjs/error-handling'

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
 * Fetch all orders from the database
 */
export async function fetchAll(): Promise<OrderType[]> {
  return await db
    .selectFrom('orders')
    .selectAll()
    .execute()
}

/**
 * Fetch orders with pagination, sorting, and filtering options
 */
export async function fetchPaginated(options: FetchOrdersOptions = {}): Promise<OrderResponse> {
  // Set default values
  const page = options.page || 1
  const limit = options.limit || 10

  // Start building the query
  let query = db.selectFrom('orders')
  let countQuery = db.selectFrom('orders')

  // Apply search filter if provided
  if (options.search) {
    const searchTerm = `%${options.search}%`
    const searchFilter = eb => eb.or([
      eb('id', 'like', searchTerm),
      eb('customer_id', '=', Number(options.search) || 0),
      eb('status', 'like', searchTerm),
      eb('order_type', 'like', searchTerm),
    ])

    query = query.where(searchFilter)
    countQuery = countQuery.where(searchFilter)
  }

  // Apply status filter if provided
  if (options.status) {
    query = query.where('status', '=', options.status)
    countQuery = countQuery.where('status', '=', options.status)
  }

  // Apply order type filter if provided
  if (options.order_type) {
    query = query.where('order_type', '=', options.order_type)
    countQuery = countQuery.where('order_type', '=', options.order_type)
  }

  // Get total count for pagination
  const countResult = await countQuery
    .select(eb => eb.fn.count('id').as('total'))
    .executeTakeFirst()

  const total = Number(countResult?.total || 0)

  // Apply pagination
  const orders = await query
    .selectAll()
    .limit(limit)
    .offset((page - 1) * limit)
    .execute()

  // Parse order_items JSON if present
  const ordersWithParsedItems = orders.map((order) => {
    if (order.order_items && typeof order.order_items === 'string') {
      try {
        return {
          ...order,
          order_items: JSON.parse(order.order_items),
        }
      }
      catch (e) {
        handleError('Error', e)
        return order
      }
    }
    return order
  })

  // Calculate pagination info
  const totalPages = Math.ceil(total / limit)

  return {
    data: ordersWithParsedItems as OrderJsonResponse[],
    paging: {
      total_records: total,
      page,
      total_pages: totalPages,
    },
    next_cursor: page < totalPages ? page + 1 : null,
  }
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

  if (order && order.order_items && typeof order.order_items === 'string') {
    return {
      ...order,
      order_items: JSON.parse(order.order_items),
    }
  }

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

  // Recent orders
  const recentOrders = await db
    .selectFrom('orders')
    .selectAll()
    .orderBy('created_at', 'desc')
    .limit(5)
    .execute()

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
