import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('order_items')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('quantity', 'numeric', col => col.notNull())
    .addColumn('price', 'numeric', col => col.notNull())
    .addColumn('special_instructions', 'text')
    .addColumn('order_id', 'integer', col =>
      col.references('orders.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
