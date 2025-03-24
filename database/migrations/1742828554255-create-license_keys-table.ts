import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('license_keys')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('key', 'text', col => col.notNull())
    .addColumn('template', 'text', col => col.notNull())
    .addColumn('expiry_date', 'text', col => col.notNull())
    .addColumn('status', 'text', col => col.defaultTo('unassigned'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
