import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('gift_cards')
    .addColumn('customer_id', 'integer', col =>
      col.references('customers.id').onDelete('cascade'))
    .execute()
}
