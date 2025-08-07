import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('transactions')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('uuid', 'uuid', col => col.defaultTo(sql.raw('gen_random_uuid()')))
    .addColumn('amount', 'integer', col => col.notNull())
    .addColumn('status', 'varchar(255)', col => col.notNull())
    .addColumn('payment_method', 'varchar(255)', col => col.notNull())
    .addColumn('payment_details', 'varchar(255)')
    .addColumn('transaction_reference', 'varchar(255)')
    .addColumn('loyalty_points_earned', 'integer')
    .addColumn('loyalty_points_redeemed', 'integer')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('transactions_id_index').on('transactions').column('id').execute()
}
