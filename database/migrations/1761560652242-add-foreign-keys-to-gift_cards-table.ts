import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('gift_cards')
    .addColumn('customer_id', 'integer', (col) =>
      col.references('customers.id').onDelete('cascade')
    ) 
    .execute()
  await db.schema.createIndex('gift_cards_customer_id_index').on('gift_cards').column('customer_id').execute()

}
