import { db, sql } from '@stacksjs/database'

export function createLikeableMethods(tableName: string, options?: { table?: string, foreignKey?: string }) {
  const likeTable = options?.table || `${tableName}_likes`
  const foreignKey = options?.foreignKey || `${tableName.replace(/s$/, '')}_id`

  return {
    async likes(id: number): Promise<any[]> {
      return await db
        .selectFrom(likeTable as any)
        .where(foreignKey, '=', id)
        .selectAll()
        .execute()
    },

    async likeCount(id: number): Promise<number> {
      const result = await db
        .selectFrom(likeTable as any)
        .select(sql`count(*) as count` as unknown as string[])
        .where(foreignKey, '=', id)
        .executeTakeFirst()

      return Number((result as any)?.count) || 0
    },

    async like(id: number, userId: number): Promise<any> {
      return await db
        .insertInto(likeTable as any)
        .values({
          [foreignKey]: id,
          user_id: userId,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirst()
    },

    async unlike(id: number, userId: number): Promise<void> {
      await db
        .deleteFrom(likeTable as any)
        .where(foreignKey, '=', id)
        .where('user_id', '=', userId)
        .execute()
    },

    async isLiked(id: number, userId: number): Promise<boolean> {
      const result = await db
        .selectFrom(likeTable as any)
        .where(foreignKey, '=', id)
        .where('user_id', '=', userId)
        .selectAll()
        .executeTakeFirst()

      return !!result
    },
  }
}
