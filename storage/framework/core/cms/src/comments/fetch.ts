import { db } from '@stacksjs/database'

export interface Commenteable {
  id?: number
  title: string
  body: string
  status: string
  approved_at: number | null
  rejected_at: number | null
  commentable_id: number
  commentable_type: string
  reports_count: number
  reported_at: number | null
  upvotes_count: number
  downvotes_count: number
  user_id: number | null
  created_at: string
  updated_at: string | null
}

export async function fetchComments(options: {
  status?: Commenteable['status']
  commentable_id?: number
  commentable_type?: string
  limit?: number
  offset?: number
} = {}): Promise<Commenteable[]> {
  let query = db.selectFrom('commenteable')

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

export async function fetchCommentById(id: number): Promise<Commenteable | undefined> {
  return db
    .selectFrom('commenteable')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export async function fetchCommentsByCommentable(
  commentable_id: number,
  commentable_type: string,
  options: { status?: Commenteable['status'], limit?: number, offset?: number } = {},
): Promise<Commenteable[]> {
  let query = db
    .selectFrom('commenteable')
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
