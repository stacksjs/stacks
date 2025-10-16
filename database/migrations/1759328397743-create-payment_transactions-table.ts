import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('payment_transactions')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('description', 'text')
    .addColumn('amount', 'integer', col => col.notNull())
    .addColumn('type', 'text', col => col.notNull())
    .addColumn('provider_id', 'text')
    .addColumn('payment_method_id', 'integer', (col) =>
        col.references('payment_methods.id').onDelete('cascade')
      ) 
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('payment_transactions_payment_method_id_index').on('payment_transactions').column(`payment_method_id`).execute()

  await db.schema.createIndex('payment_transactions_id_index').on('payment_transactions').column('id').execute()
}
