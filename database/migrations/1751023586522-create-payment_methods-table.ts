import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('payment_methods')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('type', 'varchar(512)')
    .addColumn('last_four', 'integer')
    .addColumn('brand', 'varchar(50)')
    .addColumn('exp_month', 'integer')
    .addColumn('exp_year', 'integer')
    .addColumn('is_default', 'boolean')
    .addColumn('provider_id', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('payment_methods_id_index').on('payment_methods').column('id').execute()
}
