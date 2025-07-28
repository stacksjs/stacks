import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('payment_transactions')
    .addColumn('payment_method_id', 'integer', col =>
      col.references('payment_methods.id').onDelete('cascade'))
    .execute()
}
