import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('tax_rates')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('rate', 'integer', col => col.notNull())
    .addColumn('type', 'text', col => col.notNull())
    .addColumn('country', 'text', col => col.notNull())
    .addColumn('region', 'text')
    .addColumn('status', 'text', col => col.defaultTo('active'))
    .addColumn('is_default', 'boolean', col => col.defaultTo(false))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('tax_rates_id_index').on('tax_rates').column('id').execute()
}
