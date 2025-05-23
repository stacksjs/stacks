import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('shipping_rates')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('method', 'varchar(255)', col => col.notNull())
    .addColumn('zone', 'varchar(255)', col => col.notNull())
    .addColumn('weight_from', 'integer', col => col.notNull())
    .addColumn('weight_to', 'integer', col => col.notNull())
    .addColumn('rate', 'integer', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('shipping_rates_id_index').on('shipping_rates').column('id').execute()
}
