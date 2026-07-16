import { db as _db, sql } from '@stacksjs/database'


function assertId(id: unknown, method: string): asserts id is number {
  if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) {
    throw new Error(`[orm/commentable] ${method} requires a positive numeric id (received ${String(id)})`)
  }
}

export function createCommentableMethods(tableName: string) {
  const db = _db as any
  return {
    async comments(id: number): Promise<any[]> {
      assertId(id, 'comments')
      return await db
        .selectFrom('commentables')
        .where('commentables_id', '=', id)
        .where('commentables_type', '=', tableName)
        .selectAll()
        .execute()
    },

    async commentCount(id: number): Promise<number> {
      const result = await db
        .selectFrom('commentables')
        .select(sql`count(*) as count`)
        .where('commentables_id', '=', id)
        .where('commentables_type', '=', tableName)
        .executeTakeFirst()

      return Number((result as any)?.count) || 0
    },

    async addComment(id: number, comment: { title: string, body: string }): Promise<any> {
      assertId(id, 'addComment')
      if (!comment || typeof comment.title !== 'string' || comment.title.trim().length === 0) {
        throw new Error('[orm/commentable] addComment requires a non-empty comment.title')
      }
      if (typeof comment.body !== 'string' || comment.body.trim().length === 0) {
        throw new Error('[orm/commentable] addComment requires a non-empty comment.body')
      }
      const written = await db
        .insertInto('commentables')
        .values({
          ...comment,
          commentables_id: id,
          commentables_type: tableName,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .returningAll()
        .executeTakeFirst()

      // A RETURNING-capable driver hands back the row directly; SQLite hands
      // back { changes, lastInsertRowid }, so read the row by that id. Comments
      // have no natural unique key, hence the id rather than a re-query by value.
      if (written && typeof written === 'object' && 'id' in written)
        return written

      const insertedId = (written as any)?.lastInsertRowid
      if (insertedId == null)
        return written

      return await db
        .selectFrom('commentables')
        .where('id', '=', Number(insertedId))
        .selectAll()
        .executeTakeFirst()
    },

    async approvedComments(id: number): Promise<any[]> {
      return await db
        .selectFrom('commentables')
        .where('commentables_id', '=', id)
        .where('commentables_type', '=', tableName)
        .where('status', '=', 'approved')
        .selectAll()
        .execute()
    },

    async pendingComments(id: number): Promise<any[]> {
      return await db
        .selectFrom('commentables')
        .where('commentables_id', '=', id)
        .where('commentables_type', '=', tableName)
        .where('status', '=', 'pending')
        .selectAll()
        .execute()
    },

    async rejectedComments(id: number): Promise<any[]> {
      return await db
        .selectFrom('commentables')
        .where('commentables_id', '=', id)
        .where('commentables_type', '=', tableName)
        .where('status', '=', 'rejected')
        .selectAll()
        .execute()
    },
  }
}
