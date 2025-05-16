import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('subscriptions')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('type', 'varchar(255)', col => col.notNull())
    .addColumn('plan', 'varchar(255)')
    .addColumn('provider_id', 'varchar(255)', col => col.unique().notNull())
    .addColumn('provider_status', 'varchar(255)', col => col.notNull())
    .addColumn('unit_price', 'integer')
    .addColumn('provider_type', 'varchar(255)', col => col.notNull())
    .addColumn('provider_price_id', 'varchar(255)')
    .addColumn('quantity', 'integer')
    .addColumn('trial_ends_at', 'varchar(255)')
    .addColumn('ends_at', 'varchar(255)')
    .addColumn('last_used_at', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('subscriptions_id_index').on('subscriptions').column('id').execute()
}
