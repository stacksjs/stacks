type ReviewJsonResponse = ModelRow<typeof Review>
type NewReview = NewModelData<typeof Review>
type NewReviewInput = NewReview & Partial<{
  is_verified_purchase: boolean
  is_approved: boolean
  helpful_votes: number
  unhelpful_votes: number
  is_featured: boolean
}>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new product review
 *
 * @param data The review data to store
 * @returns The newly created review record
 */
export async function store(data: NewReviewInput): Promise<ReviewJsonResponse> {
  try {
    const reviewData = {
      ...data,
      uuid: randomUUIDv7(),
      is_verified_purchase: data.is_verified_purchase ?? false,
      is_approved: data.is_approved ?? false,
      helpful_votes: data.helpful_votes ?? 0,
      unhelpful_votes: data.unhelpful_votes ?? 0,
      is_featured: data.is_featured ?? false,
    }

    const result = await db
      .insertInto('reviews')
      .values(reviewData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create review')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Duplicate entry')) {
        throw new Error('A review with this code already exists')
      }

      throw new Error(`Failed to create review: ${error.message}`)
    }

    throw error
  }
}
