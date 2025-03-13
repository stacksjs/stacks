import type { CustomerJsonResponse, CustomersTable } from '../types'
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
export async function fetchById(id: number): Promise<CustomerJsonResponse | undefined> {
  return await db
    .selectFrom('customers')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}
