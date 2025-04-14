import type { Comment } from './fetch'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

interface CommentUpdate {
  title?: string
  body?: string
  status?: string
  approved_at?: number | null
  rejected_at?: number | null
  reports_count?: number
  reported_at?: number | null
  upvotes_count?: number
  downvotes_count?: number
  user_id?: number | null
  updated_at?: string | null
}

/**
 * Update a comment by ID
 *
 * @param id The ID of the comment to update
 * @param data The updated comment data
 * @returns The updated comment record
 */
export async function update(id: number, data: CommentUpdate): Promise<Comment | undefined> {
  try {
    // Create update data object
    const updateData: CommentUpdate = {
      ...data,
      updated_at: formatDate(new Date()),
    }

    if (Object.keys(updateData).length === 0) {
      return await db
        .selectFrom('comments')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst()
    }

    // Update the comment record
    await db
      .updateTable('comments')
      .set(updateData)
      .where('id', '=', id)
      .execute()

    const updatedComment = await db
      .selectFrom('comments')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()

    return updatedComment
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update comment: ${error.message}`)
    }

    throw error
  }
}
