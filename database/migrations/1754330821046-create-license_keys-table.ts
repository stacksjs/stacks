import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('license_keys')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('uuid', 'uuid', (col) => col.defaultTo(sql.raw('gen_random_uuid()')))
    .addColumn('key', 'varchar(255)', col => col.notNull())
    .addColumn('template', 'varchar(255)', col => col.notNull())
    .addColumn('expiry_date', 'timestamp', col => col.notNull())
    .addColumn('status', 'varchar(255)', col => col.defaultTo('unassigned'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('license_keys_id_index').on('license_keys').column('id').execute()
}
