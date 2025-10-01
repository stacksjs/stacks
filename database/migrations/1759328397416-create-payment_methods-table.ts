import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('payment_methods')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('type', 'text', col => col.notNull())
    .addColumn('last_four', 'integer', col => col.notNull())
    .addColumn('brand', 'text', col => col.notNull())
    .addColumn('exp_month', 'integer', col => col.notNull())
    .addColumn('exp_year', 'integer', col => col.notNull())
    .addColumn('is_default', 'boolean')
    .addColumn('provider_id', 'text')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('payment_methods_id_index').on('payment_methods').column('id').execute()
}
