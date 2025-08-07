import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('order_items')
    .addColumn('order_id', 'integer', col =>
      col.references('orders.id').onDelete('cascade'))
    .execute()
  await db.schema.createIndex('order_items_order_id_index').on('order_items').column('order_id').execute()
}
