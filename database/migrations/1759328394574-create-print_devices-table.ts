import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('print_devices')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('mac_address', 'text', col => col.notNull())
    .addColumn('location', 'text', col => col.notNull())
    .addColumn('terminal', 'text', col => col.notNull())
    .addColumn('status', 'text', col => col.notNull())
    .addColumn('last_ping', 'bigint', col => col.notNull())
    .addColumn('print_count', 'integer', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('print_devices_id_index').on('print_devices').column('id').execute()
}
