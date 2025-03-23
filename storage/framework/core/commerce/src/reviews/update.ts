import type { ReviewRequestType } from '@stacksjs/orm'
import type { ReviewJsonResponse } from '../../../../orm/src/models/Review'
import { db } from '@stacksjs/database'
import { fetchById } from './fetch'

/**
 * Update a review by ID
 *
 * @param id The ID of the review to update
 * @param request The updated review data
 * @returns The updated review record
 */
export async function update(id: number, request: ReviewRequestType): Promise<ReviewJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  // Check if review exists
  const existingReview = await fetchById(id)
  if (!existingReview) {
    throw new Error(`Review with ID ${id} not found`)
  }

  // Create update data object using request fields
  const updateData = {
    product_id: request.get<number>('product_id'),
    customer_id: request.get<number>('customer_id'),
    rating: request.get<number>('rating'),
    title: request.get('title'),
    is_featured: request.get<boolean>('is_featured'),
    content: request.get('content'),
    is_verified_purchase: request.get<boolean>('is_verified_purchase'),
    is_approved: request.get<boolean>('is_approved'),
    helpful_votes: request.get<number>('helpful_votes'),
    unhelpful_votes: request.get<number>('unhelpful_votes'),
    purchase_date: request.get('purchase_date'),
    images: request.get('images'),
    uuid: request.get('uuid'),
    updated_at: new Date().toISOString(),
  }

  // If no fields to update, just return the existing review
  if (Object.keys(updateData).length === 0) {
    return existingReview
  }

  try {
    // Update the review
    await db
      .updateTable('reviews')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    // Fetch and return the updated review
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update review: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update a review's vote counts
 *
 * @param id The ID of the review
 * @param voteType The type of vote ('helpful' or 'unhelpful')
 * @param increment Whether to increment (true) or decrement (false) the vote count
 * @returns The updated review with new vote counts
 */
export async function updateVotes(
  id: number,
  voteType: 'helpful' | 'unhelpful',
  increment: boolean = true,
): Promise<ReviewJsonResponse | undefined> {
  // Check if review exists
  const review = await fetchById(id)

  if (!review) {
    throw new Error(`Review with ID ${id} not found`)
  }

  // Determine which field to update and by how much
  const field = voteType === 'helpful' ? 'helpful_votes' : 'unhelpful_votes'
  const currentValue = review[field] || 0
  const changeAmount = increment ? 1 : -1
  const newValue = Math.max(0, currentValue + changeAmount) // Prevent negative vote counts

  try {
    // Update the review vote count
    await db
      .updateTable('reviews')
      .set({
        [field]: newValue,
        updated_at: new Date().toISOString(),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated review
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update review votes: ${error.message}`)
    }

    throw error
  }
}
