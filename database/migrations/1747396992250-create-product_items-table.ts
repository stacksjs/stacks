import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('product_items')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('name', 'varchar(255)', col => col.notNull())
    .addColumn('size', 'varchar(255)')
    .addColumn('color', 'varchar(255)')
    .addColumn('price', 'integer', col => col.notNull())
    .addColumn('image_url', 'varchar(255)')
    .addColumn('is_available', 'boolean')
    .addColumn('inventory_count', 'integer')
    .addColumn('sku', 'varchar(255)', col => col.notNull())
    .addColumn('custom_options', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('product_items_id_index').on('product_items').column('id').execute()
}
