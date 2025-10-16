import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('digital_deliveries')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('description', 'text', col => col.notNull())
    .addColumn('download_limit', 'integer')
    .addColumn('expiry_days', 'integer', col => col.notNull())
    .addColumn('requires_login', 'boolean', col => col.defaultTo(false))
    .addColumn('automatic_delivery', 'boolean', col => col.defaultTo(false))
    .addColumn('status', 'text', col => col.defaultTo('active'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('digital_deliveries_id_index').on('digital_deliveries').column('id').execute()
}
