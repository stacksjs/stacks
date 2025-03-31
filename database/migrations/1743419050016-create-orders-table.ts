import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('orders')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('status', 'text', col => col.notNull())
    .addColumn('total_amount', 'numeric', col => col.notNull())
    .addColumn('tax_amount', 'numeric')
    .addColumn('discount_amount', 'numeric')
    .addColumn('delivery_fee', 'numeric')
    .addColumn('tip_amount', 'numeric')
    .addColumn('order_type', 'text', col => col.notNull())
    .addColumn('delivery_address', 'text')
    .addColumn('special_instructions', 'text')
    .addColumn('estimated_delivery_time', 'text')
    .addColumn('applied_coupon_id', 'text')
    .addColumn('customer_id', 'integer', col =>
      col.references('customers.id').onDelete('cascade'))
    .addColumn('gift_card_id', 'integer', col =>
      col.references('gift_cards.id').onDelete('cascade'))
    .addColumn('coupon_id', 'integer', col =>
      col.references('coupons.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('orders_customer_id_index').on('orders').column('customer_id').execute()

  await db.schema.createIndex('orders_gift_card_id_index').on('orders').column('gift_card_id').execute()

  await db.schema.createIndex('orders_coupon_id_index').on('orders').column('coupon_id').execute()
}
