import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('order_items')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('quantity', 'integer', col => col.notNull().defaultTo(1))
    .addColumn('price', 'integer', col => col.notNull())
    .addColumn('special_instructions', 'text')
    .addColumn('order_id', 'integer', (col) =>
        col.references('orders.id').onDelete('cascade')
      ) 
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('order_items_order_id_index').on('order_items').column(`order_id`).execute()

  await db.schema.createIndex('order_items_id_index').on('order_items').column('id').execute()
}
