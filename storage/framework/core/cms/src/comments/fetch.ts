import { db } from '@stacksjs/database'

export interface Comment {
  id: number
  title: string
  body: string
  status: 'pending' | 'approved' | 'rejected'
  approved_at: number | null
  rejected_at: number | null
  commentable_id: number
  commentable_type: string
  created_at: Date
  updated_at: Date | null
}

export async function fetchComments(options: {
  status?: Comment['status']
  commentable_id?: number
  commentable_type?: string
  limit?: number
  offset?: number
} = {}): Promise<Comment[]> {
  let query = db.selectFrom('comments')

  if (options.status)
    query = query.where('status', '=', options.status)

  if (options.commentable_id)
    query = query.where('commentable_id', '=', options.commentable_id)

  if (options.commentable_type)
    query = query.where('commentable_type', '=', options.commentable_type)

  if (options.limit)
    query = query.limit(options.limit)

  if (options.offset)
    query = query.offset(options.offset)

  return query.selectAll().execute()
}

export async function fetchCommentById(id: number): Promise<Comment | undefined> {
  return db
    .selectFrom('comments')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export async function fetchCommentsByCommentable(
  commentable_id: number,
  commentable_type: string,
  options: { status?: Comment['status'], limit?: number, offset?: number } = {},
): Promise<Comment[]> {
  let query = db
    .selectFrom('comments')
    .where('commentable_id', '=', commentable_id)
    .where('commentable_type', '=', commentable_type)

  if (options.status)
    query = query.where('status', '=', options.status)

  if (options.limit)
    query = query.limit(options.limit)

  if (options.offset)
    query = query.offset(options.offset)

  return query.selectAll().execute()
}
