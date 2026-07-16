import { db as _db } from '@stacksjs/database'

// `db` is a Proxy whose methods are typed via bun-query-builder's generics —
// resolution to the concrete invocation here can leave methods marked
// `T | undefined` under strict null checks. Cast through `any` so the trait
// helpers can call the runtime-defined methods without a guard at every site.

export function createCategorizableMethods(tableName: string) {
  const db = _db as any
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
        .selectFrom('categorizables')
        .where('id', 'in', categoryIds)
        .selectAll()
        .execute()
    },

    async categoryCount(id: number): Promise<number> {
      const categoryIds = await getCategoryIds(id)
      return categoryIds.length
    },

    async addCategory(id: number, category: { name: string, description?: string }): Promise<any> {
      // Categories are scoped by owner type, so look up (and later create)
      // within this `categorizable_type`.
      const findCategory = () => db
        .selectFrom('categorizables')
        .where('name', '=', category.name)
        .where('categorizable_type', '=', tableName)
        .selectAll()
        .executeTakeFirst()

      let categoryRecord = await findCategory()

      if (!categoryRecord) {
        await db
          .insertInto('categorizables')
          .values({
            name: category.name,
            description: category.description,
            slug: category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            // categorizables.categorizable_type is NOT NULL: it scopes the
            // category to the owning model type, the same way the CMS module's
            // categorizables.store() sets it.
            categorizable_type: tableName,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .execute()

        // Re-select rather than trust the write's return value: on SQLite an
        // insert can surface only { changes, lastInsertRowid }, so reading the
        // row back is the driver-agnostic way to get its id for the link below.
        categoryRecord = await findCategory()
      }

      await db
        .insertInto('categorizable_models')
        .values({
          categorizable_id: id,
          categorizable_type: tableName,
          category_id: (categoryRecord as any).id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .execute()

      return categoryRecord
    },

    async activeCategories(id: number): Promise<any[]> {
      const categoryIds = await getCategoryIds(id)
      if (categoryIds.length === 0) return []

      return await db
        .selectFrom('categorizables')
        .where('id', 'in', categoryIds)
        .where('is_active', '=', true)
        .selectAll()
        .execute()
    },

    async inactiveCategories(id: number): Promise<any[]> {
      const categoryIds = await getCategoryIds(id)
      if (categoryIds.length === 0) return []

      return await db
        .selectFrom('categorizables')
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
