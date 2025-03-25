import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('shipping_zones')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('countries', 'text')
    .addColumn('regions', 'text')
    .addColumn('postal_codes', 'text')
    .addColumn('status', 'text', col => col.notNull())
    .addColumn('shipping_method_id', 'integer', col =>
      col.references('shipping_methods.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
