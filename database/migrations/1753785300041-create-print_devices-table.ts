import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('print_devices')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('uuid', 'uuid', col => col.defaultTo(sql.raw('gen_random_uuid()')))
    .addColumn('name', 'varchar(100)', col => col.notNull())
    .addColumn('mac_address', 'varchar(50)', col => col.notNull())
    .addColumn('location', 'varchar(100)', col => col.notNull())
    .addColumn('terminal', 'varchar(50)', col => col.notNull())
    .addColumn('status', 'varchar(255)', col => col.notNull())
    .addColumn('last_ping', 'bigint', col => col.notNull())
    .addColumn('print_count', 'integer', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('print_devices_id_index').on('print_devices').column('id').execute()
}
