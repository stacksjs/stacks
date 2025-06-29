import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('payment_products')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('name', 'varchar(512)')
    .addColumn('description', 'varchar(255)')
    .addColumn('key', 'varchar(255)')
    .addColumn('unit_price', 'integer')
    .addColumn('status', 'varchar(255)')
    .addColumn('image', 'varchar(255)')
    .addColumn('provider_id', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('payment_products_id_index').on('payment_products').column('id').execute()
}
