import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('transactions')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('amount', 'integer', col => col.notNull())
    .addColumn('status', 'text', col => col.notNull())
    .addColumn('payment_method', 'text', col => col.notNull())
    .addColumn('payment_details', 'text')
    .addColumn('transaction_reference', 'text')
    .addColumn('loyalty_points_earned', 'integer')
    .addColumn('loyalty_points_redeemed', 'integer')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('transactions_id_index').on('transactions').column('id').execute()
}
