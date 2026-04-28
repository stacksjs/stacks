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
        .select(sql`count(*) as count`)
        .where(foreignKey, '=', id)
        .executeTakeFirst()

      return Number((result as any)?.count) || 0
    },

    /**
     * Record that user `userId` likes the row `id` of the parent model.
     * Idempotent — duplicate calls just return the existing row instead of
     * crashing on the unique (user_id, <fk>) constraint.
     */
    async like(id: number, userId: number): Promise<any> {
      if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) {
        throw new Error(`[orm/likeable] like requires a positive numeric id (received ${String(id)})`)
      }
      if (typeof userId !== 'number' || !Number.isFinite(userId) || userId <= 0) {
        throw new Error(`[orm/likeable] like requires a positive numeric userId (received ${String(userId)})`)
      }
      const now = new Date().toISOString()
      try {
        return await db
          .insertInto(likeTable as any)
          .values({
            [foreignKey]: id,
            user_id: userId,
            created_at: now,
            updated_at: now,
          })
          .returningAll()
          .executeTakeFirst()
      }
      catch (err: unknown) {
        // Distinguish unique-constraint violations from "real" errors.
        // SQLite reports SQLITE_CONSTRAINT_UNIQUE; MySQL throws ER_DUP_ENTRY
        // (errno 1062); Postgres uses code 23505. If the error doesn't
        // match any of those, treat it as fatal and surface it instead of
        // silently swallowing a (e.g.) connection-lost error.
        const e = err as { code?: string, errno?: number, message?: string }
        const looksLikeDuplicate
          = e.code === 'SQLITE_CONSTRAINT_UNIQUE'
          || e.code === 'SQLITE_CONSTRAINT'
          || e.code === '23505'
          || e.errno === 1062
          || /unique|duplicate/i.test(e.message ?? '')
        if (!looksLikeDuplicate) throw err

        const existing = await db
          .selectFrom(likeTable as any)
          .where(foreignKey, '=', id)
          .where('user_id', '=', userId)
          .selectAll()
          .executeTakeFirst()
        if (existing) return existing
        throw err
      }
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

    /**
     * Reverse lookup — every row in the parent model that the given user has
     * liked. Returns just the parent FK values (cheap join in the action).
     */
    async likedBy(userId: number): Promise<number[]> {
      const rows = await db
        .selectFrom(likeTable as any)
        .select([foreignKey])
        .where('user_id', '=', userId)
        .execute()
      return rows.map((r: any) => Number(r[foreignKey])).filter(Boolean)
    },
  }
}
