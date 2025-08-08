import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('products')
    .addColumn('category_id', 'integer', col =>
      col.references('categories.id').onDelete('cascade'))
    .addColumn('manufacturer_id', 'integer', col =>
      col.references('manufacturers.id').onDelete('cascade'))
    .execute()
  await db.schema.createIndex('products_category_id_index').on('products').column('category_id').execute()

  await db.schema.createIndex('products_manufacturer_id_index').on('products').column('manufacturer_id').execute()
}
