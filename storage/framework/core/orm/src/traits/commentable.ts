import { db, sql } from '@stacksjs/database'

export function createCommentableMethods(tableName: string) {
  return {
    async comments(id: number): Promise<any[]> {
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
        .select(sql`count(*) as count` as unknown as string[])
        .where('commentables_id', '=', id)
        .where('commentables_type', '=', tableName)
        .executeTakeFirst()

      return Number((result as any)?.count) || 0
    },

    async addComment(id: number, comment: { title: string, body: string }): Promise<any> {
      return await db
        .insertInto('comments')
        .values({
          ...comment,
          commentables_id: id,
          commentables_type: tableName,
          status: 'pending',
          created_at: new Date(),
          updated_at: new Date(),
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
