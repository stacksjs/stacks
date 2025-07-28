import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('digital_deliveries')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('uuid', 'uuid', col => col.defaultTo(sql.raw('gen_random_uuid()')))
    .addColumn('name', 'varchar(255)', col => col.notNull())
    .addColumn('description', 'varchar(255)', col => col.notNull())
    .addColumn('download_limit', 'integer')
    .addColumn('expiry_days', 'integer', col => col.notNull())
    .addColumn('requires_login', 'boolean', col => col.defaultTo(false))
    .addColumn('automatic_delivery', 'boolean', col => col.defaultTo(false))
    .addColumn('status', 'varchar(255)', col => col.defaultTo('active'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('digital_deliveries_id_index').on('digital_deliveries').column('id').execute()
}
