import { db as _db, sql } from '@stacksjs/database'

// See note in categorizable.ts — relax db method types for trait helpers.
// Wrapped in a Proxy so each property access reads `_db` at call time, not
// at module-load time. Reading `_db` at the top level triggers a TDZ
// "Cannot access '_db' before initialization" when this module loads during
// the @stacksjs/database → @stacksjs/orm → @stacksjs/database import cycle.
const db: any = new Proxy({} as any, {
  get(_target, prop) { return (_db as any)[prop] },
})

function assertId(id: unknown, method: string): asserts id is number {
  if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) {
    throw new Error(`[orm/commentable] ${method} requires a positive numeric id (received ${String(id)})`)
  }
}

export function createCommentableMethods(tableName: string) {
  return {
    async comments(id: number): Promise<any[]> {
      assertId(id, 'comments')
      return await db
        .selectFrom('comments')
        .where('commentables_id', '=', id)
        .where('commentables_type', '=', tableName)
        .selectAll()
        .execute()
    },

    async commentCount(id: number): Promise<number> {
      const result = await db
        .selectFrom('comments')
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
      return await db
        .insertInto('comments')
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
    },

    async approvedComments(id: number): Promise<any[]> {
      return await db
        .selectFrom('comments')
        .where('commentables_id', '=', id)
        .where('commentables_type', '=', tableName)
        .where('status', '=', 'approved')
        .selectAll()
        .execute()
    },

    async pendingComments(id: number): Promise<any[]> {
      return await db
        .selectFrom('comments')
        .where('commentables_id', '=', id)
        .where('commentables_type', '=', tableName)
        .where('status', '=', 'pending')
        .selectAll()
        .execute()
    },

    async rejectedComments(id: number): Promise<any[]> {
      return await db
        .selectFrom('comments')
        .where('commentables_id', '=', id)
        .where('commentables_type', '=', tableName)
        .where('status', '=', 'rejected')
        .selectAll()
        .execute()
    },
  }
}
