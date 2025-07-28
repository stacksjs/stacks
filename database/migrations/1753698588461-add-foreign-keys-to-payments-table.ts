import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('payments')
    .addColumn('customer_id', 'integer', col =>
      col.references('customers.id').onDelete('cascade'))
    .addColumn('order_id', 'integer', col =>
      col.references('orders.id').onDelete('cascade'))
    .execute()
}
