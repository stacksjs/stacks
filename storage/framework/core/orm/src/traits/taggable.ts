import { db, sql } from '@stacksjs/database'

export function createTaggableMethods(tableName: string) {
  return {
    async tags(id: number): Promise<any[]> {
      return await db
        .selectFrom('taggable')
        .where('taggable_id', '=', id)
        .where('taggable_type', '=', tableName)
        .selectAll()
        .execute()
    },

    async tagCount(id: number): Promise<number> {
      const result = await db
        .selectFrom('taggable')
        .select(sql`count(*) as count`)
        .where('taggable_id', '=', id)
        .where('taggable_type', '=', tableName)
        .executeTakeFirst()

      return Number((result as any)?.count) || 0
    },

    async addTag(id: number, tag: { name: string, description?: string }): Promise<any> {
      return await db
        .insertInto('taggable')
        .values({
          ...tag,
          taggable_id: id,
          taggable_type: tableName,
          slug: tag.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          order: 0,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
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
