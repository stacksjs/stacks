import type { Comment } from './fetch'
import { db } from '@stacksjs/database'

export interface CreateCommentInput {
  title: string
  body: string
  commentable_id: number
  commentable_type: string
}

export interface UpdateCommentInput {
  title?: string
  body?: string
  status?: Comment['status']
}

export async function createComment(input: CreateCommentInput): Promise<Comment> {
  const now = new Date()

  return db
    .insertInto('comments')
    .values({
      ...input,
      status: 'pending',
      created_at: now,
      updated_at: now,
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function updateComment(
  id: number,
  input: UpdateCommentInput,
): Promise<Comment> {
  return db
    .updateTable('comments')
    .set({
      ...input,
      updated_at: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function approveComment(id: number): Promise<Comment> {
  return db
    .updateTable('comments')
    .set({
      status: 'approved',
      approved_at: Date.now(),
      updated_at: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function rejectComment(id: number): Promise<Comment> {
  return db
    .updateTable('comments')
    .set({
      status: 'rejected',
      rejected_at: Date.now(),
      updated_at: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export async function deleteComment(id: number): Promise<void> {
  await db
    .deleteFrom('comments')
    .where('id', '=', id)
    .execute()
}
