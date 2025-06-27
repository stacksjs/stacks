import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('gift_cards')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('code', 'varchar(50)', col => col.notNull().unique())
    .addColumn('initial_balance', 'integer', col => col.notNull())
    .addColumn('current_balance', 'integer', col => col.notNull())
    .addColumn('currency', 'varchar(3)')
    .addColumn('status', 'varchar(255)', col => col.notNull())
    .addColumn('purchaser_id', 'varchar(255)')
    .addColumn('recipient_email', 'varchar(255)')
    .addColumn('recipient_name', 'varchar(255)')
    .addColumn('personal_message', 'varchar(255)')
    .addColumn('is_digital', 'boolean')
    .addColumn('is_reloadable', 'boolean')
    .addColumn('is_active', 'boolean', col => col.defaultTo(true))
    .addColumn('expiry_date', 'timestamp')
    .addColumn('last_used_date', 'timestamp')
    .addColumn('template_id', 'varchar(255)')
    .addColumn('customer_id', 'integer', col =>
      col.references('customers.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('gift_cards_customer_id_index').on('gift_cards').column('customer_id').execute()

  await db.schema.createIndex('gift_cards_id_index').on('gift_cards').column('id').execute()
}
