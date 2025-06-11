import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('products')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('name', 'varchar(100)', col => col.notNull())
    .addColumn('description', 'varchar(255)')
    .addColumn('price', 'integer', col => col.notNull())
    .addColumn('image_url', 'varchar(255)')
    .addColumn('is_available', 'boolean')
    .addColumn('inventory_count', 'integer')
    .addColumn('preparation_time', 'integer', col => col.notNull())
    .addColumn('allergens', 'varchar(255)')
    .addColumn('nutritional_info', 'varchar(255)')
    .addColumn('category_id', 'integer', col =>
      col.references('categories.id').onDelete('cascade'))
    .addColumn('manufacturer_id', 'integer', col =>
      col.references('manufacturers.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('products_category_id_index').on('products').column('category_id').execute()

  await db.schema.createIndex('products_manufacturer_id_index').on('products').column('manufacturer_id').execute()

  await db.schema.createIndex('products_id_index').on('products').column('id').execute()
}
