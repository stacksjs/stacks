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
    if (data.title !== undefined && data.title.trim() === '') {
      throw new Error('Comment title cannot be empty')
    }

    if (data.body !== undefined && data.body.trim() === '') {
      throw new Error('Comment body cannot be empty')
    }

    const validStatuses = ['pending', 'approved', 'rejected']
    if (data.status !== undefined && !validStatuses.includes(data.status)) {
      throw new Error(`Invalid comment status: ${data.status}`)
    }

    // Only include fields that are explicitly provided
    const commentData: Record<string, unknown> = {
      updated_at: formatDate(new Date()),
    }

    if (data.title !== undefined) commentData.title = data.title
    if (data.body !== undefined) commentData.body = data.body
    if (data.status !== undefined) commentData.status = data.status
    if (data.commentables_id !== undefined) commentData.commentables_id = data.commentables_id
    if (data.commentables_type !== undefined) commentData.commentables_type = data.commentables_type
    if (data.approved_at !== undefined) commentData.approved_at = data.approved_at
    if (data.rejected_at !== undefined) commentData.rejected_at = data.rejected_at

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

    return updatedComment as unknown as CommentablesTable | undefined
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update comment: ${error.message}`)
    }

    throw error
  }
}
