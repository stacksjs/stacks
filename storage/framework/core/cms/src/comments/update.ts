import type { CommentablesTable } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

interface CommentUpdate {
  title?: string
  body?: string
  status?: string
  approved_at?: number | null
  rejected_at?: number | null
  commentables_id?: number
  commentables_type?: string
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
export async function update(id: number, data: CommentUpdate): Promise<CommentablesTable | undefined> {
  try {
    const commentData = {
      title: data.title,
      body: data.body,
      commentables_id: data.commentables_id,
      commentables_type: data.commentables_type,
      status: 'pending',
      approved_at: data.approved_at,
      rejected_at: data.rejected_at,
      updated_at: formatDate(new Date()),
    }

    if (Object.keys(commentData).length === 0) {
      return await db
        .selectFrom('commentables')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst()
    }

    // Update the comment record
    await db
      .updateTable('commentables')
      .set(commentData)
      .where('id', '=', id)
      .execute()

    const updatedComment = await db
      .selectFrom('commentables')
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
