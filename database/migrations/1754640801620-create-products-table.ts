import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('products')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('uuid', 'uuid', col => col.defaultTo(sql.raw('gen_random_uuid()')))
    .addColumn('name', 'varchar(100)', col => col.notNull())
    .addColumn('description', 'varchar(255)')
    .addColumn('price', 'integer', col => col.notNull())
    .addColumn('image_url', 'varchar(255)')
    .addColumn('is_available', 'boolean')
    .addColumn('inventory_count', 'integer')
    .addColumn('preparation_time', 'integer', col => col.notNull())
    .addColumn('allergens', 'varchar(255)')
    .addColumn('nutritional_info', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('products_id_index').on('products').column('id').execute()
}
