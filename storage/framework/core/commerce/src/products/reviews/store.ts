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
 * Whether a review says anything at all.
 *
 * A review is a rating, a written comment, or both. Which of those a shop
 * collects is the shop's decision, so neither column is required on its own -
 * but a row carrying neither is not a review, and it is worse than useless:
 * it inflates the review count on a product nobody has actually said anything
 * about.
 *
 * This cannot live on the model. Validation there runs per attribute, and the
 * rule spans two.
 */
function isEmptyReview(data: NewReviewInput): boolean {
  const hasRating = data.rating !== undefined && data.rating !== null
  const hasContent = typeof data.content === 'string' && data.content.trim().length > 0
  const hasTitle = typeof data.title === 'string' && data.title.trim().length > 0

  return !hasRating && !hasContent && !hasTitle
}

/**
 * Create a new product review
 *
 * Accepts a rating with no comment, a comment with no rating, or both.
 *
 * @param data The review data to store
 * @returns The newly created review record
 */
export async function store(data: NewReviewInput): Promise<ReviewJsonResponse> {
  try {
    if (isEmptyReview(data))
      throw new Error('A review needs a rating or something written: both were empty')

    const reviewData = {
      ...data,
      uuid: randomUUIDv7(),
      // Normalised so "not rated" is one value rather than three. An average
      // has to skip these rows, and it cannot skip what it cannot recognise.
      rating: data.rating ?? null,
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
