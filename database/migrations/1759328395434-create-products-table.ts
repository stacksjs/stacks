import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('products')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('description', 'text')
    .addColumn('price', 'integer', col => col.notNull())
    .addColumn('image_url', 'text')
    .addColumn('is_available', 'boolean')
    .addColumn('inventory_count', 'integer')
    .addColumn('preparation_time', 'integer', col => col.notNull())
    .addColumn('allergens', 'text')
    .addColumn('nutritional_info', 'text')
    .addColumn('category_id', 'integer', (col) =>
        col.references('categories.id').onDelete('cascade')
      ) 
    .addColumn('manufacturer_id', 'integer', (col) =>
        col.references('manufacturers.id').onDelete('cascade')
      ) 
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('products_category_id_index').on('products').column(`category_id`).execute()

  await db.schema.createIndex('products_manufacturer_id_index').on('products').column(`manufacturer_id`).execute()

  await db.schema.createIndex('products_id_index').on('products').column('id').execute()
}
