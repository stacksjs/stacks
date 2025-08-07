import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('carts')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('uuid', 'uuid', (col) => col.defaultTo(sql.raw('gen_random_uuid()')))
    .addColumn('status', 'varchar(255)', col => col.defaultTo('active'))
    .addColumn('total_items', 'integer', col => col.defaultTo(0))
    .addColumn('subtotal', 'integer', col => col.defaultTo(0))
    .addColumn('tax_amount', 'integer', col => col.defaultTo(0))
    .addColumn('discount_amount', 'integer', col => col.defaultTo(0))
    .addColumn('total', 'integer', col => col.defaultTo(0))
    .addColumn('expires_at', 'timestamp', col => col.notNull())
    .addColumn('currency', 'varchar(3)', col => col.defaultTo('USD'))
    .addColumn('notes', 'varchar(1000)')
    .addColumn('applied_coupon_id', 'varchar(255)', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('carts_id_index').on('carts').column('id').execute()
}
