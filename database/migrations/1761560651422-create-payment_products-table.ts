import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('payment_products')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('uuid', 'uuid', (col) => col.defaultTo(sql.raw('gen_random_uuid()')))
    .addColumn('name', 'varchar(512)', col => col.notNull())
    .addColumn('description', 'varchar(255)')
    .addColumn('key', 'varchar(255)', col => col.notNull())
    .addColumn('unit_price', 'integer', col => col.notNull())
    .addColumn('status', 'varchar(255)')
    .addColumn('image', 'varchar(255)')
    .addColumn('provider_id', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('payment_products_id_index').on('payment_products').column('id').execute()
}
