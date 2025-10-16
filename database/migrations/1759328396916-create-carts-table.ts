import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('carts')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('status', 'text', col => col.defaultTo('active'))
    .addColumn('total_items', 'integer', col => col.defaultTo(0))
    .addColumn('subtotal', 'integer', col => col.defaultTo(0))
    .addColumn('tax_amount', 'integer', col => col.defaultTo(0))
    .addColumn('discount_amount', 'integer', col => col.defaultTo(0))
    .addColumn('total', 'integer', col => col.defaultTo(0))
    .addColumn('expires_at', 'timestamp', col => col.notNull())
    .addColumn('currency', 'text', col => col.defaultTo('USD'))
    .addColumn('notes', 'text')
    .addColumn('applied_coupon_id', 'text', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('carts_id_index').on('carts').column('id').execute()
}
