import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('shipping_methods')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('name', 'varchar(100)', col => col.notNull())
    .addColumn('description', 'varchar(500)')
    .addColumn('base_rate', 'integer', col => col.notNull())
    .addColumn('free_shipping', 'integer')
    .addColumn('status', sql`enum('active', 'inactive', 'draft')`, col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('shipping_methods_id_index').on('shipping_methods').column('id').execute()
}
