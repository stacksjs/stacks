import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('wait_list_products')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('email', 'text', col => col.notNull())
    .addColumn('phone', 'text')
    .addColumn('party_size', 'numeric', col => col.notNull())
    .addColumn('notification_preference', 'text', col => col.notNull())
    .addColumn('source', 'text', col => col.notNull())
    .addColumn('notes', 'text')
    .addColumn('status', 'text', col => col.notNull().defaultTo('waiting'))
    .addColumn('notified_at', 'text')
    .addColumn('purchased_at', 'text')
    .addColumn('cancelled_at', 'text')
    .addColumn('customer_id', 'integer', col =>
      col.references('customers.id').onDelete('cascade'))
    .addColumn('product_id', 'integer', col =>
      col.references('products.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
