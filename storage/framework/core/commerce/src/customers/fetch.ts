import type { CustomerTable } from '../types'
import { db } from '@stacksjs/database'

export interface FetchCustomersOptions {
  page?: number
  limit?: number
  search?: string
  status?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedCustomers {
  customers: CustomerTable[]
  pagination: {
    total: number
    currentPage: number
    totalPages: number
    limit: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export interface CustomerStats {
  total: number
  active: number
  inactive: number
  topSpenders: Partial<CustomerTable>[]
  recentCustomers: Partial<CustomerTable>[]
}

/**
 * Fetch all customers from the database
 */
export async function fetchAll(): Promise<CustomerTable[]> {
  return await db
    .selectFrom('customers')
    .selectAll()
    .execute()
}

/**
 * Fetch customers with pagination, sorting, and filtering options
 */
export async function fetchPaginated(options: FetchCustomersOptions = {}): Promise<PaginatedCustomers> {
  // Set default values
  const page = options.page || 1
  const limit = options.limit || 10
  const offset = (page - 1) * limit
  const sortBy = options.sortBy || 'created_at'
  const sortOrder = options.sortOrder || 'desc'

  // Start building the query
  let query = db.selectFrom('customers')
  let countQuery = db.selectFrom('customers')

  // Apply search filter if provided
  if (options.search) {
    const searchTerm = `%${options.search}%`
    const searchFilter = eb => eb.or([
      eb('name', 'like', searchTerm),
      eb('email', 'like', searchTerm),
      eb('phone', 'like', searchTerm),
    ])

    query = query.where(searchFilter)
    countQuery = countQuery.where(searchFilter)
  }

  // Apply status filter if provided and not 'all'
  if (options.status && options.status !== 'all') {
    query = query.where('status', '=', options.status)
    countQuery = countQuery.where('status', '=', options.status)
  }

  // Get total count for pagination
  const countResult = await countQuery
    .select(eb => eb.fn.count('id').as('total'))
    .executeTakeFirst()

  const total = Number(countResult?.total || 0)

  // Apply sorting
  // Note: Ensure the column is valid to prevent SQL injection
  const validColumns = ['name', 'email', 'orders', 'totalSpent', 'lastOrder', 'status', 'created_at', 'updated_at']
  const validSortBy = validColumns.includes(sortBy) ? sortBy : 'created_at'

  query = query.orderBy(validSortBy, sortOrder)

  // Apply pagination
  query = query.limit(limit).offset(offset)

  // Execute the query
  const customers = await query.selectAll().execute()

  // Calculate pagination info
  const totalPages = Math.ceil(total / limit)

  return {
    customers,
    pagination: {
      total,
      currentPage: page,
      totalPages,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  }
}

/**
 * Fetch a customer by ID
 */
export async function fetchById(id: number): Promise<CustomerTable | undefined> {
  return await db
    .selectFrom('customers')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Get customer statistics
 */
export async function fetchStats(): Promise<CustomerStats> {
  const totalCustomers = await db
    .selectFrom('customers')
    .select(eb => eb.fn.count('id').as('count'))
    .executeTakeFirst()

  const activeCustomers = await db
    .selectFrom('customers')
    .where('status', '=', 'Active')
    .select(eb => eb.fn.count('id').as('count'))
    .executeTakeFirst()

  const inactiveCustomers = await db
    .selectFrom('customers')
    .where('status', '=', 'Inactive')
    .select(eb => eb.fn.count('id').as('count'))
    .executeTakeFirst()

  const topSpenders = await db
    .selectFrom('customers')
    .select(['id', 'name', 'email', 'totalSpent'])
    .orderBy('totalSpent', 'desc')
    .limit(5)
    .execute()

  const recentCustomers = await db
    .selectFrom('customers')
    .select(['id', 'name', 'email', 'created_at'])
    .orderBy('created_at', 'desc')
    .limit(5)
    .execute()

  return {
    total: Number(totalCustomers?.count || 0),
    active: Number(activeCustomers?.count || 0),
    inactive: Number(inactiveCustomers?.count || 0),
    topSpenders,
    recentCustomers,
  }
}
