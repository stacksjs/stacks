import type { CouponJsonResponse, CouponResponse } from '../../../../orm/src/models/Coupon'
import type { CouponStats } from '../../types'
import { db } from '@stacksjs/database'

export interface FetchCouponsOptions {
  page?: number
  limit?: number
  search?: string
  is_active?: boolean
  discount_type?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  product_id?: string
  category_id?: string
  from_date?: string
  to_date?: string
}

/**
 * Process coupon data from the database
 * Parses JSON strings for applicable_products and applicable_categories
 */
function processCouponData(coupon: CouponJsonResponse): CouponJsonResponse {
  // Create a copy to avoid modifying the original object
  const processed = { ...coupon }

  // Parse applicable_products if it exists and is a string
  if (processed.applicable_products && typeof processed.applicable_products === 'string') {
    processed.applicable_products = JSON.parse(processed.applicable_products)
  }

  // Parse applicable_categories if it exists and is a string
  if (processed.applicable_categories && typeof processed.applicable_categories === 'string') {
    processed.applicable_categories = JSON.parse(processed.applicable_categories)
  }

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
 * Fetch coupons with pagination, sorting, and filtering options
 */
export async function fetchPaginated(options: FetchCouponsOptions = {}): Promise<CouponResponse> {
  // Set default values
  const page = options.page || 1
  const limit = options.limit || 10

  // Start building the query
  let query = db.selectFrom('coupons')
  let countQuery = db.selectFrom('coupons')

  // Apply search filter if provided
  if (options.search) {
    const searchTerm = `%${options.search}%`
    const searchFilter = (eb: any) => eb.or([
      eb('code', 'like', searchTerm),
      eb('description', 'like', searchTerm),
      eb('discount_type', 'like', searchTerm),
    ])

    query = query.where(searchFilter)
    countQuery = countQuery.where(searchFilter)
  }

  // Apply discount type filter if provided
  if (options.discount_type) {
    query = query.where('discount_type', '=', options.discount_type)
    countQuery = countQuery.where('discount_type', '=', options.discount_type)
  }

  // Apply date range filter if provided
  if (options.from_date) {
    query = query.where('start_date', '>=', options.from_date)
    countQuery = countQuery.where('start_date', '>=', options.from_date)
  }

  if (options.to_date) {
    query = query.where('end_date', '<=', options.to_date)
    countQuery = countQuery.where('end_date', '<=', options.to_date)
  }

  // Apply product_id filter if provided
  if (options.product_id) {
    // This will filter coupons where the applicable_products JSON array contains the product_id
    // Note: This is a simplistic approach and may need adjustment based on database
    query = query.where('applicable_products', 'like', `%${options.product_id}%`)
    countQuery = countQuery.where('applicable_products', 'like', `%${options.product_id}%`)
  }

  // Apply category_id filter if provided
  if (options.category_id) {
    // This will filter coupons where the applicable_categories JSON array contains the category_id
    query = query.where('applicable_categories', 'like', `%${options.category_id}%`)
    countQuery = countQuery.where('applicable_categories', 'like', `%${options.category_id}%`)
  }

  // Get total count for pagination
  const countResult = await countQuery
    .select(eb => eb.fn.count('id').as('total'))
    .executeTakeFirst()

  const total = Number(countResult?.total || 0)

  // Apply pagination
  const coupons = await query
    .selectAll()
    .limit(limit)
    .offset((page - 1) * limit)
    .execute()

  // Process coupon data (parse JSON fields)
  const processedCoupons = coupons.map(processCouponData)

  // Calculate pagination info
  const totalPages = Math.ceil(total / limit)

  return {
    data: processedCoupons,
    paging: {
      total_records: total,
      page,
      total_pages: totalPages,
    },
    next_cursor: page < totalPages ? page + 1 : null,
  }
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
export async function fetchActive(options: FetchCouponsOptions = {}): Promise<CouponResponse> {
  const currentDate = new Date().toISOString().split('T')[0]

  return fetchPaginated({
    ...options,
    is_active: true,
    from_date: currentDate,
    to_date: currentDate,
  })
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
  const currentDate = new Date().toISOString().split('T')[0]
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
