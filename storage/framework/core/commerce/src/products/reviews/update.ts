import type { ReviewJsonResponse, ReviewUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

/**
 * Update a review
 *
 * @param id The id of the review to update
 * @param data The review data to update
 * @returns The updated review record
 */
export async function update(id: number, data: ReviewUpdate): Promise<ReviewJsonResponse> {
  try {
    if (!id)
      throw new Error('Review ID is required for update')

    const result = await db
      .updateTable('reviews')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update review')

    return result
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
): Promise<ReviewJsonResponse> {
  try {
    const result = await db
      .updateTable('reviews')
      .set({
        [voteType === 'helpful' ? 'helpful_votes' : 'unhelpful_votes']: increment ? 1 : -1,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to update review votes')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update review votes: ${error.message}`)
    }

    throw error
  }
}
