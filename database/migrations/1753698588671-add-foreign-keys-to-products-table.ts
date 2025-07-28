import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('products')
    .addColumn('category_id', 'integer', col =>
      col.references('categories.id').onDelete('cascade'))
    .addColumn('manufacturer_id', 'integer', col =>
      col.references('manufacturers.id').onDelete('cascade'))
    .execute()
}
