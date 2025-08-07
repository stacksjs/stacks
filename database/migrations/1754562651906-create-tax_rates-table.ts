import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('tax_rates')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('uuid', 'uuid', (col) => col.defaultTo(sql.raw('gen_random_uuid()')))
    .addColumn('name', 'varchar(255)', col => col.notNull())
    .addColumn('rate', 'integer', col => col.notNull())
    .addColumn('type', 'varchar(100)', col => col.notNull())
    .addColumn('country', 'varchar(100)', col => col.notNull())
    .addColumn('region', 'varchar(255)')
    .addColumn('status', 'varchar(255)', col => col.defaultTo('active'))
    .addColumn('is_default', 'boolean', col => col.defaultTo(false))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('tax_rates_id_index').on('tax_rates').column('id').execute()
}
