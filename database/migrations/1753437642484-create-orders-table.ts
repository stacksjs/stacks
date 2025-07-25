import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('orders')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql.raw('gen_random_uuid()')))
    .addColumn('status', 'varchar(255)', col => col.notNull())
    .addColumn('total_amount', 'integer', col => col.notNull())
    .addColumn('tax_amount', 'integer')
    .addColumn('discount_amount', 'integer')
    .addColumn('delivery_fee', 'integer')
    .addColumn('tip_amount', 'integer')
    .addColumn('order_type', 'varchar(255)', col => col.notNull())
    .addColumn('delivery_address', 'varchar(255)')
    .addColumn('special_instructions', 'varchar(255)')
    .addColumn('estimated_delivery_time', 'varchar(255)')
    .addColumn('applied_coupon_id', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('orders_id_index').on('orders').column('id').execute()
}
