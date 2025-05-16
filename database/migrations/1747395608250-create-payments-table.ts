import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('payments')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('amount', 'double', col => col.notNull())
    .addColumn('method', 'varchar(255)', col => col.notNull())
    .addColumn('status', 'varchar(255)', col => col.notNull())
    .addColumn('currency', 'varchar(255)')
    .addColumn('reference_number', 'varchar(255)')
    .addColumn('card_last_four', 'varchar(255)')
    .addColumn('card_brand', 'varchar(255)')
    .addColumn('billing_email', 'varchar(255)')
    .addColumn('transaction_id', 'varchar(255)', col => col.unique())
    .addColumn('payment_provider', 'varchar(255)')
    .addColumn('refund_amount', 'double')
    .addColumn('notes', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('payments_id_index').on('payments').column('id').execute()
}
