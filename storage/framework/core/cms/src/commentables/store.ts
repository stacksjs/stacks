import type { CommentablesTable } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

export interface CreateCommentInput {
  title: string
  body: string
  commentables_id: number
  commentables_type: string
}

export interface UpdateCommentInput {
  title?: string
  body?: string
  status?: string
}

export async function createComment(data: CreateCommentInput): Promise<CommentablesTable> {
  const now = new Date()

  const commentData = {
    title: data.title,
    body: data.body,
    commentables_id: data.commentables_id,
    commentables_type: data.commentables_type,
    status: 'pending',
    created_at: now.toISOString(),
  }

  return db
    .insertInto('commentables')
    .values(commentData)
    .returningAll()
    .executeTakeFirstOrThrow() as unknown as Promise<CommentablesTable>
}

export async function updateComment(
  id: number,
  input: UpdateCommentInput,
): Promise<CommentablesTable> {
  return db
    .updateTable('commentables')
    .set({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow() as unknown as Promise<CommentablesTable>
}

export async function approveComment(id: number): Promise<CommentablesTable> {
  return db
    .updateTable('commentables')
    .set({
      status: 'approved',
      approved_at: Date.now(),
      updated_at: new Date().toISOString(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow() as unknown as Promise<CommentablesTable>
}

export async function rejectComment(id: number): Promise<CommentablesTable> {
  return db
    .updateTable('commentables')
    .set({
      status: 'rejected',
      rejected_at: Date.now(),
      updated_at: new Date().toISOString(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow() as unknown as Promise<CommentablesTable>
}

export async function deleteComment(id: number): Promise<void> {
  await db
    .deleteFrom('commentables')
    .where('id', '=', id)
    .execute()
}

interface CommentStore {
  title: string
  body: string
  status: string
  user_id: number
  commentables_id: number
  commentables_type: string
  is_active?: boolean | null
  approved_at?: number | null
  rejected_at?: number | null
}

/**
 * Create a new comment
 *
 * @param data The comment data to store
 * @returns The newly created comment record
 */
export async function store(data: CommentStore): Promise<CommentablesTable> {
  try {
    if (!data.title || data.title.trim() === '') {
      throw new Error('Comment title is required')
    }

    if (!data.body || data.body.trim() === '') {
      throw new Error('Comment body is required')
    }

    if (!data.commentables_type || data.commentables_type.trim() === '') {
      throw new Error('Comment commentables_type is required')
    }

    const validStatuses = ['pending', 'approved', 'rejected']
    if (data.status && !validStatuses.includes(data.status)) {
      throw new Error(`Invalid comment status: ${data.status}`)
    }

    const commentData = {
      title: data.title,
      body: data.body,
      status: data.status,
      commentables_id: data.commentables_id,
      commentables_type: data.commentables_type,
      user_id: data.user_id,
      is_active: data.is_active,
    }

    const result = await db
      .insertInto('commentables')
      .values(commentData)
      .returningAll()
      .executeTakeFirst()

    if (!result) {
      throw new Error('Failed to create comment')
    }

    return result as unknown as CommentablesTable
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to store comment: ${error.message}`)
    }

    throw error
  }
}
