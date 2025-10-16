import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('gift_cards')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('code', 'text', col => col.notNull().unique())
    .addColumn('initial_balance', 'integer', col => col.notNull())
    .addColumn('current_balance', 'integer', col => col.notNull())
    .addColumn('currency', 'text')
    .addColumn('status', 'text', col => col.notNull())
    .addColumn('purchaser_id', 'text')
    .addColumn('recipient_email', 'text')
    .addColumn('recipient_name', 'text')
    .addColumn('personal_message', 'text')
    .addColumn('is_digital', 'boolean')
    .addColumn('is_reloadable', 'boolean')
    .addColumn('is_active', 'boolean', col => col.defaultTo(true))
    .addColumn('expiry_date', 'timestamp')
    .addColumn('last_used_date', 'timestamp')
    .addColumn('template_id', 'text')
    .addColumn('customer_id', 'integer', (col) =>
        col.references('customers.id').onDelete('cascade')
      ) 
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('gift_cards_customer_id_index').on('gift_cards').column(`customer_id`).execute()

  await db.schema.createIndex('gift_cards_id_index').on('gift_cards').column('id').execute()
}
