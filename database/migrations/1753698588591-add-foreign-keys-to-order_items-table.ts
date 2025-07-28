import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('order_items')
    .addColumn('order_id', 'integer', col =>
      col.references('orders.id').onDelete('cascade'))
    .execute()
}
