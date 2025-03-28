import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('wait_list_restaurants')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('email', 'text', col => col.notNull())
    .addColumn('phone', 'text')
    .addColumn('party_size', 'numeric', col => col.notNull())
    .addColumn('check_in_time', 'text', col => col.notNull())
    .addColumn('table_preference', 'text', col => col.notNull())
    .addColumn('status', 'text', col => col.notNull().defaultTo('waiting'))
    .addColumn('quoted_wait_time', 'numeric', col => col.notNull())
    .addColumn('actual_wait_time', 'numeric')
    .addColumn('queue_position', 'numeric')
    .addColumn('customer_id', 'integer', col =>
      col.references('customers.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
