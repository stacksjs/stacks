import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('products')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('name', 'varchar(255)', col => col.notNull())
    .addColumn('description', 'varchar(255)')
    .addColumn('price', 'double', col => col.notNull())
    .addColumn('image_url', 'varchar(255)')
    .addColumn('is_available', 'boolean')
    .addColumn('inventory_count', 'double')
    .addColumn('preparation_time', 'double', col => col.notNull())
    .addColumn('allergens', 'varchar(255)')
    .addColumn('nutritional_info', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('products_id_index').on('products').column('id').execute()
}
