import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('orders')
    .addColumn('customer_id', 'integer', (col) =>
      col.references('customers.id').onDelete('cascade')
    ) 
    .addColumn('gift_card_id', 'integer', (col) =>
      col.references('gift_cards.id').onDelete('cascade')
    ) 
    .addColumn('coupon_id', 'integer', (col) =>
      col.references('coupons.id').onDelete('cascade')
    ) 
    .execute()
  await db.schema.createIndex('orders_customer_id_index').on('orders').column('customer_id').execute()

  await db.schema.createIndex('orders_gift_card_id_index').on('orders').column('gift_card_id').execute()

  await db.schema.createIndex('orders_coupon_id_index').on('orders').column('coupon_id').execute()

}
