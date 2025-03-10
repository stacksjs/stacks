import type { ProductReviewJsonResponse } from '../../../../orm/src/models/ProductReview'
import type { FetchProductReviewsOptions, ProductReviewResponse, ProductReviewStats } from '../../types'
import { db } from '@stacksjs/database'

/**
 * Fetch product reviews with pagination
 */
export async function fetchPaginated(options: FetchProductReviewsOptions = {}): Promise<ProductReviewResponse> {
  // Set default values
  const page = options.page || 1
  const limit = options.limit || 10

  // Start building the query
  const query = db.selectFrom('product_reviews')
  const countQuery = db.selectFrom('product_reviews')

  // Get total count for pagination
  const countResult = await countQuery
    .select(eb => eb.fn.count('id').as('total'))
    .executeTakeFirst()

  const total = Number(countResult?.total || 0)

  // Apply pagination
  const productReviews = await query
    .selectAll()
    .limit(limit)
    .offset((page - 1) * limit)
    .execute()

  // Calculate pagination info
  const totalPages = Math.ceil(total / limit)

  return {
    data: productReviews,
    paging: {
      total_records: total,
      page,
      total_pages: totalPages,
    },
    next_cursor: page < totalPages ? page + 1 : null,
  }
}

/**
 * Fetch a product review by ID
 */
export async function fetchById(id: number): Promise<ProductReviewJsonResponse | undefined> {
  return await db
    .selectFrom('product_reviews')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch reviews for a specific product
 */
export async function fetchByProductId(productId: number, options: FetchProductReviewsOptions = {}): Promise<ProductReviewResponse> {
  // Set default values
  const page = options.page || 1
  const limit = options.limit || 10

  // Start building the query
  const query = db.selectFrom('product_reviews')
    .where('product_id', '=', productId)

  const countQuery = db.selectFrom('product_reviews')
    .where('product_id', '=', productId)

  // Get total count for pagination
  const countResult = await countQuery
    .select(eb => eb.fn.count('id').as('total'))
    .executeTakeFirst()

  const total = Number(countResult?.total || 0)

  // Apply pagination
  const productReviews = await query
    .selectAll()
    .limit(limit)
    .offset((page - 1) * limit)
    .execute()

  // Calculate pagination info
  const totalPages = Math.ceil(total / limit)

  return {
    data: productReviews,
    paging: {
      total_records: total,
      page,
      total_pages: totalPages,
    },
    next_cursor: page < totalPages ? page + 1 : null,
  }
}

/**
 * Fetch reviews by user ID
 */
export async function fetchByUserId(userId: number, options: FetchProductReviewsOptions = {}): Promise<ProductReviewResponse> {
  // Set default values
  const page = options.page || 1
  const limit = options.limit || 10

  // Start building the query
  const query = db.selectFrom('product_reviews')
    .where('customer_id', '=', userId)

  const countQuery = db.selectFrom('product_reviews')
    .where('customer_id', '=', userId)

  // Get total count for pagination
  const countResult = await countQuery
    .select(eb => eb.fn.count('id').as('total'))
    .executeTakeFirst()

  const total = Number(countResult?.total || 0)

  // Apply pagination
  const productReviews = await query
    .selectAll()
    .limit(limit)
    .offset((page - 1) * limit)
    .execute()

  // Calculate pagination info
  const totalPages = Math.ceil(total / limit)

  return {
    data: productReviews,
    paging: {
      total_records: total,
      page,
      total_pages: totalPages,
    },
    next_cursor: page < totalPages ? page + 1 : null,
  }
}

/**
 * Fetch approved reviews for a product
 */
export async function fetchApprovedByProductId(productId: number, options: FetchProductReviewsOptions = {}): Promise<ProductReviewResponse> {
  // Set default values
  const page = options.page || 1
  const limit = options.limit || 10

  // Start building the query
  const query = db.selectFrom('product_reviews')
    .where('product_id', '=', productId)
    .where('is_approved', '=', true)

  const countQuery = db.selectFrom('product_reviews')
    .where('product_id', '=', productId)
    .where('is_approved', '=', true)

  // Get total count for pagination
  const countResult = await countQuery
    .select(eb => eb.fn.count('id').as('total'))
    .executeTakeFirst()

  const total = Number(countResult?.total || 0)

  // Apply pagination
  const productReviews = await query
    .selectAll()
    .limit(limit)
    .offset((page - 1) * limit)
    .execute()

  // Calculate pagination info
  const totalPages = Math.ceil(total / limit)

  return {
    data: productReviews,
    paging: {
      total_records: total,
      page,
      total_pages: totalPages,
    },
    next_cursor: page < totalPages ? page + 1 : null,
  }
}

/**
 * Get review statistics for a product
 */
export async function fetchProductReviewStats(productId: number): Promise<ProductReviewStats> {
  // Total reviews for the product
  const totalReviews = await db
    .selectFrom('product_reviews')
    .where('product_id', '=', productId)
    .where('is_approved', '=', true)
    .select(eb => eb.fn.count('id').as('count'))
    .executeTakeFirst()

  // Average rating
  const avgRating = await db
    .selectFrom('product_reviews')
    .where('product_id', '=', productId)
    .where('is_approved', '=', true)
    .select(eb => eb.fn.avg('rating').as('avg_rating'))
    .executeTakeFirst()

  // Rating distribution
  const oneStarCount = await db
    .selectFrom('product_reviews')
    .where('product_id', '=', productId)
    .where('is_approved', '=', true)
    .where('rating', '=', 1)
    .select(eb => eb.fn.count('id').as('count'))
    .executeTakeFirst()

  const twoStarCount = await db
    .selectFrom('product_reviews')
    .where('product_id', '=', productId)
    .where('is_approved', '=', true)
    .where('rating', '=', 2)
    .select(eb => eb.fn.count('id').as('count'))
    .executeTakeFirst()

  const threeStarCount = await db
    .selectFrom('product_reviews')
    .where('product_id', '=', productId)
    .where('is_approved', '=', true)
    .where('rating', '=', 3)
    .select(eb => eb.fn.count('id').as('count'))
    .executeTakeFirst()

  const fourStarCount = await db
    .selectFrom('product_reviews')
    .where('product_id', '=', productId)
    .where('is_approved', '=', true)
    .where('rating', '=', 4)
    .select(eb => eb.fn.count('id').as('count'))
    .executeTakeFirst()

  const fiveStarCount = await db
    .selectFrom('product_reviews')
    .where('product_id', '=', productId)
    .where('is_approved', '=', true)
    .where('rating', '=', 5)
    .select(eb => eb.fn.count('id').as('count'))
    .executeTakeFirst()

  // Recent reviews
  const recentReviews = await db
    .selectFrom('product_reviews')
    .where('product_id', '=', productId)
    .where('is_approved', '=', true)
    .selectAll()
    .orderBy('created_at', 'desc')
    .limit(5)
    .execute()

  return {
    total: Number(totalReviews?.count || 0),
    average_rating: Number(avgRating?.avg_rating || 0),
    rating_distribution: {
      one_star: Number(oneStarCount?.count || 0),
      two_star: Number(twoStarCount?.count || 0),
      three_star: Number(threeStarCount?.count || 0),
      four_star: Number(fourStarCount?.count || 0),
      five_star: Number(fiveStarCount?.count || 0),
    },
    recent_reviews: recentReviews,
  }
}

/**
 * Fetch most helpful reviews for a product
 */
export async function fetchMostHelpfulByProductId(productId: number, limit: number = 5): Promise<ProductReviewJsonResponse[]> {
  return await db
    .selectFrom('product_reviews')
    .where('product_id', '=', productId)
    .where('is_approved', '=', true)
    .selectAll()
    .orderBy('helpful_votes', 'desc')
    .limit(limit)
    .execute()
}
