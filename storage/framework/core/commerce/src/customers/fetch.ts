import type { CustomersTable } from '../../types'
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
  customers: CustomersTable[]
  pagination: {
    total: number
    currentPage: number
    totalPages: number
    limit: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

/**
 * Fetch a customer by ID
 */
export async function fetchById(id: number): Promise<CustomersTable | undefined> {
  return await db
    .selectFrom('customers')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch customers with simple pagination, sorting, and basic search
 * A minimal implementation that works well while planning for Algolia/Meilisearch
 */
export async function fetchPaginated(options: FetchCustomersOptions = {}): Promise<PaginatedCustomers> {
  // Set default values
  const page = options.page || 1
  const limit = options.limit || 10

  // Start building the query
  let query = db.selectFrom('customers')
  let countQuery = db.selectFrom('customers')

  // Simple name search if provided
  if (options.search && options.search.trim()) {
    const searchTerm = `%${options.search.trim()}%`
    query = query.where('name', 'like', searchTerm)
    countQuery = countQuery.where('name', 'like', searchTerm)
  }

  // Get total count
  const countResult = await countQuery
    .select(eb => eb.fn.count('id').as('total'))
    .executeTakeFirst()

  const total = Number(countResult?.total || 0)

  // Basic pagination
  const customers = await query
    .selectAll()
    .limit(limit)
    .offset((page - 1) * limit)
    .execute()

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
