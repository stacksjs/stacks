import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('payment_transactions')
    .addColumn('payment_method_id', 'integer', (col) =>
      col.references('payment_methods.id').onDelete('cascade')
    ) 
    .execute()
  await db.schema.createIndex('payment_transactions_payment_method_id_index').on('payment_transactions').column('payment_method_id').execute()

}
