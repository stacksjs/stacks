import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('orders')
    .addColumn('customer_id', 'integer', col =>
      col.references('customers.id').onDelete('cascade'))
    .addColumn('gift_card_id', 'integer', col =>
      col.references('gift_cards.id').onDelete('cascade'))
    .addColumn('coupon_id', 'integer', col =>
      col.references('coupons.id').onDelete('cascade'))
    .execute()
}
