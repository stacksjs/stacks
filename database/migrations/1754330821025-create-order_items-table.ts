import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('order_items')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('quantity', 'integer', col => col.notNull().defaultTo(1))
    .addColumn('price', 'integer', col => col.notNull())
    .addColumn('special_instructions', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('order_items_id_index').on('order_items').column('id').execute()
}
