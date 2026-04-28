import { db, sql } from '@stacksjs/database'

/**
 * Validate the parent record id passed to a trait method. Negative or
 * non-finite IDs used to silently return empty arrays / 0 counts and
 * masked legitimate "I'm passing the wrong variable" bugs upstream.
 */
function assertId(id: unknown, method: string): asserts id is number {
  if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) {
    throw new Error(`[orm/taggable] ${method} requires a positive numeric id (received ${String(id)})`)
  }
}

export function createTaggableMethods(tableName: string) {
  return {
    async tags(id: number): Promise<any[]> {
      assertId(id, 'tags')
      return await db
        .selectFrom('taggable')
        .where('taggable_id', '=', id)
        .where('taggable_type', '=', tableName)
        .selectAll()
        .execute()
    },

    async tagCount(id: number): Promise<number> {
      assertId(id, 'tagCount')
      const result = await db
        .selectFrom('taggable')
        .select(sql`count(*) as count`)
        .where('taggable_id', '=', id)
        .where('taggable_type', '=', tableName)
        .executeTakeFirst()

      return Number((result as any)?.count) || 0
    },

    async addTag(id: number, tag: { name: string, description?: string }): Promise<any> {
      assertId(id, 'addTag')
      if (!tag || typeof tag.name !== 'string' || tag.name.trim().length === 0) {
        throw new Error('[orm/taggable] addTag requires a non-empty tag.name')
      }
      return await db
        .insertInto('taggable')
        .values({
          ...tag,
          taggable_id: id,
          taggable_type: tableName,
          slug: tag.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          order: 0,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .returningAll()
        .executeTakeFirst()
    },

    async activeTags(id: number): Promise<any[]> {
      return await db
        .selectFrom('taggable')
        .where('taggable_id', '=', id)
        .where('taggable_type', '=', tableName)
        .where('is_active', '=', true)
        .selectAll()
        .execute()
    },

    async inactiveTags(id: number): Promise<any[]> {
      return await db
        .selectFrom('taggable')
        .where('taggable_id', '=', id)
        .where('taggable_type', '=', tableName)
        .where('is_active', '=', false)
        .selectAll()
        .execute()
    },

    async removeTag(id: number, tagId: number): Promise<void> {
      await db
        .deleteFrom('taggable')
        .where('taggable_id', '=', id)
        .where('taggable_type', '=', tableName)
        .where('id', '=', tagId)
        .execute()
    },
  }
}
