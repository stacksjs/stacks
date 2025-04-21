import type { ReviewJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a product review by ID
 */
export async function fetchById(id: number): Promise<ReviewJsonResponse | undefined> {
  return await db
    .selectFrom('reviews')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Fetch all product reviews
 */
export async function fetchAll(): Promise<ReviewJsonResponse[]> {
  return await db.selectFrom('reviews').selectAll().execute()
}

/**
 * Fetch reviews for a specific product
 */
export async function fetchByProductId(productId: number): Promise<ReviewJsonResponse[]> {
  return await db
    .selectFrom('reviews')
    .where('product_id', '=', productId)
    .selectAll()
    .execute()
}

/**
 * Fetch reviews by user ID
 */
export async function fetchByUserId(userId: number): Promise<ReviewJsonResponse[]> {
  return await db
    .selectFrom('reviews')
    .where('customer_id', '=', userId)
    .selectAll()
    .execute()
}

/**
 * Fetch approved reviews for a product
 */
export async function fetchApprovedByProductId(productId: number): Promise<ReviewJsonResponse[]> {
  return await db
    .selectFrom('reviews')
    .where('product_id', '=', productId)
    .where('is_approved', '=', true)
    .selectAll()
    .execute()
}

export async function fetchMostHelpfulByProductId(productId: number): Promise<ReviewJsonResponse[]> {
  return await db
    .selectFrom('reviews')
    .where('product_id', '=', productId)
    .orderBy('helpful_votes', 'desc')
    .selectAll()
    .execute()
}
