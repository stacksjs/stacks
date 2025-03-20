import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('payments')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('amount', 'numeric', col => col.notNull())
    .addColumn('method', 'text', col => col.notNull())
    .addColumn('status', 'text', col => col.notNull())
    .addColumn('currency', 'text')
    .addColumn('reference_number', 'text')
    .addColumn('card_last_four', 'text')
    .addColumn('card_brand', 'text')
    .addColumn('billing_email', 'text')
    .addColumn('transaction_id', 'text')
    .addColumn('payment_provider', 'text')
    .addColumn('refund_amount', 'numeric')
    .addColumn('notes', 'text')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
