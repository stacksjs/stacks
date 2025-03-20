import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('products')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('description', 'text')
    .addColumn('price', 'numeric', col => col.notNull())
    .addColumn('image_url', 'text')
    .addColumn('is_available', 'integer')
    .addColumn('inventory_count', 'numeric')
    .addColumn('category_id', 'text', col => col.notNull())
    .addColumn('preparation_time', 'numeric', col => col.notNull())
    .addColumn('allergens', 'text')
    .addColumn('nutritional_info', 'text')
    .addColumn('manufacturer_id', 'integer', col =>
      col.references('manufacturers.id').onDelete('cascade'))
    .addColumn('product_category_id', 'integer', col =>
      col.references('product_categories.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
