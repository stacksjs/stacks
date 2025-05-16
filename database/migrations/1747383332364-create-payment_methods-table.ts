import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('payment_methods')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('type', 'text', col => col.notNull())
    .addColumn('last_four', 'text', col => col.notNull())
    .addColumn('brand', 'text', col => col.notNull())
    .addColumn('exp_month', 'text', col => col.notNull())
    .addColumn('exp_year', 'text', col => col.notNull())
    .addColumn('is_default', 'text')
    .addColumn('provider_id', 'text')
    .addColumn('user_id', 'integer', col =>
      col.references('users.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('payment_methods_user_id_index').on('payment_methods').column('user_id').execute()

  await db.schema.createIndex('payment_methods_id_index').on('payment_methods').column('id').execute()
}
