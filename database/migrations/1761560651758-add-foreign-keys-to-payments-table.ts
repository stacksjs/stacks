import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('payments')
    .addColumn('customer_id', 'integer', (col) =>
      col.references('customers.id').onDelete('cascade')
    ) 
    .addColumn('order_id', 'integer', (col) =>
      col.references('orders.id').onDelete('cascade')
    ) 
    .execute()
  await db.schema.createIndex('payments_customer_id_index').on('payments').column('customer_id').execute()

  await db.schema.createIndex('payments_order_id_index').on('payments').column('order_id').execute()

}
