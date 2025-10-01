import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('payments')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('amount', 'integer', col => col.notNull())
    .addColumn('method', 'text', col => col.notNull())
    .addColumn('status', 'text', col => col.notNull())
    .addColumn('currency', 'text')
    .addColumn('reference_number', 'text')
    .addColumn('card_last_four', 'text')
    .addColumn('card_brand', 'text')
    .addColumn('billing_email', 'text')
    .addColumn('transaction_id', 'text', col => col.unique())
    .addColumn('payment_provider', 'text')
    .addColumn('refund_amount', 'integer')
    .addColumn('notes', 'text')
    .addColumn('customer_id', 'integer', (col) =>
        col.references('customers.id').onDelete('cascade')
      ) 
    .addColumn('order_id', 'integer', (col) =>
        col.references('orders.id').onDelete('cascade')
      ) 
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('payments_customer_id_index').on('payments').column(`customer_id`).execute()

  await db.schema.createIndex('payments_order_id_index').on('payments').column(`order_id`).execute()

  await db.schema.createIndex('payments_id_index').on('payments').column('id').execute()
}
