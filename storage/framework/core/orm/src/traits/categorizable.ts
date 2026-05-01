import { db as _db } from '@stacksjs/database'

// `db` is a Proxy whose methods are typed via bun-query-builder's generics —
// resolution to the concrete invocation here can leave methods marked
// `T | undefined` under strict null checks. Cast through `any` so the trait
// helpers can call the runtime-defined methods without a guard at every site.
const db = _db as any

export function createCategorizableMethods(tableName: string) {
  async function getCategoryIds(id: number): Promise<number[]> {
    const categoryLinks = await db
      .selectFrom('categorizable_models')
      .where('categorizable_id', '=', id)
      .where('categorizable_type', '=', tableName)
      .selectAll()
      .execute()

    return (categoryLinks as Array<{ category_id: number }>).map(link => link.category_id)
  }

  return {
    async categories(id: number): Promise<any[]> {
      const categoryIds = await getCategoryIds(id)
      if (categoryIds.length === 0) return []

      return await db
        .selectFrom('categorizable')
        .where('id', 'in', categoryIds)
        .selectAll()
        .execute()
    },

    async categoryCount(id: number): Promise<number> {
      const categoryIds = await getCategoryIds(id)
      return categoryIds.length
    },

    async addCategory(id: number, category: { name: string, description?: string }): Promise<any> {
      let categoryRecord = await db
        .selectFrom('categorizable')
        .where('name', '=', category.name)
        .selectAll()
        .executeTakeFirst()

      if (!categoryRecord) {
        categoryRecord = await db
          .insertInto('categorizable')
          .values({
            name: category.name,
            description: category.description,
            slug: category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .returningAll()
          .executeTakeFirst()
      }

      return await db
        .insertInto('categorizable_models')
        .values({
          categorizable_id: id,
          categorizable_type: tableName,
          category_id: (categoryRecord as any).id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .returningAll()
        .executeTakeFirst()
    },

    async activeCategories(id: number): Promise<any[]> {
      const categoryIds = await getCategoryIds(id)
      if (categoryIds.length === 0) return []

      return await db
        .selectFrom('categorizable')
        .where('id', 'in', categoryIds)
        .where('is_active', '=', true)
        .selectAll()
        .execute()
    },

    async inactiveCategories(id: number): Promise<any[]> {
      const categoryIds = await getCategoryIds(id)
      if (categoryIds.length === 0) return []

      return await db
        .selectFrom('categorizable')
        .where('id', 'in', categoryIds)
        .where('is_active', '=', false)
        .selectAll()
        .execute()
    },

    async removeCategory(id: number, categoryId: number): Promise<void> {
      await db
        .deleteFrom('categorizable_models')
        .where('categorizable_id', '=', id)
        .where('categorizable_type', '=', tableName)
        .where('category_id', '=', categoryId)
        .execute()
    },
  }
}
