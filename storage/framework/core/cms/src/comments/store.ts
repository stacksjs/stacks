import type { Commentable } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'

export interface CreateCommentInput {
  title: string
  body: string
  commentable_id: number
  commentable_type: string
}

export interface UpdateCommentInput {
  title?: string
  body?: string
  status?: Commentable['status']
}

export async function createComment(input: CreateCommentInput): Promise<Commentable> {
  const now = new Date()

  return db
    .insertInto('commentable')
    .values({
      ...input,
      status: 'pending',
      reports_count: 0,
      upvotes_count: 0,
      downvotes_count: 0,
      approved_at: null,
      rejected_at: null,
      reported_at: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function updateComment(
  id: number,
  input: UpdateCommentInput,
): Promise<Commentable> {
  return db
    .updateTable('commentable')
    .set({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function approveComment(id: number): Promise<Commentable> {
  return db
    .updateTable('commentable')
    .set({
      status: 'approved',
      approved_at: Date.now(),
      updated_at: new Date().toISOString(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function rejectComment(id: number): Promise<Commentable> {
  return db
    .updateTable('commentable')
    .set({
      status: 'rejected',
      rejected_at: Date.now(),
      updated_at: new Date().toISOString(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function deleteComment(id: number): Promise<void> {
  await db
    .deleteFrom('commentable')
    .where('id', '=', id)
    .execute()
}

interface CommentStore {
  title: string
  body: string
  status: string
  commentable_id: number
  commentable_type: string
  user_id?: number | null
}

/**
 * Create a new comment
 *
 * @param data The comment data to store
 * @returns The newly created comment record
 */
export async function store(data: CommentStore): Promise<Commentable> {
  try {
    const now = formatDate(new Date())

    const commentData = {
      ...data,
      reports_count: 0,
      upvotes_count: 0,
      downvotes_count: 0,
      approved_at: null,
      rejected_at: null,
      reported_at: null,
      created_at: now,
      updated_at: null,
    }

    const result = await db
      .insertInto('commentable')
      .values(commentData)
      .returningAll()
      .executeTakeFirst()

    if (!result) {
      throw new Error('Failed to create comment')
    }

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to store comment: ${error.message}`)
    }

    throw error
  }
}
