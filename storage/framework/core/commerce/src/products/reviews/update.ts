import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
type ReviewJsonResponse = ModelRow<typeof Review>
type ReviewUpdate = UpdateModelData<typeof Review>

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
    const column = voteType === 'helpful' ? 'helpful_votes' : 'unhelpful_votes'
    const expr = increment
      ? `COALESCE("${column}", 0) + 1`
      : `MAX(COALESCE("${column}", 0) - 1, 0)`

    const result = await db
      .unsafe(
        `UPDATE "reviews" SET "${column}" = ${expr}, "updated_at" = ? WHERE "id" = ? RETURNING *`,
        [formatDate(new Date()), id],
      )
      .execute()

    const row = Array.isArray(result) ? result[0] : result

    if (!row)
      throw new Error('Failed to update review votes')

    return row
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update review votes: ${error.message}`)
    }

    throw error
  }
}
