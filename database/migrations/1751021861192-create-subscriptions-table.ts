import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('subscriptions')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('type', 'varchar(512)')
    .addColumn('plan', 'varchar(100)')
    .addColumn('provider_id', 'varchar(255)', col => col.unique())
    .addColumn('provider_status', 'varchar(255)')
    .addColumn('unit_price', 'integer')
    .addColumn('provider_type', 'varchar(255)')
    .addColumn('provider_price_id', 'varchar(255)')
    .addColumn('quantity', 'integer')
    .addColumn('trial_ends_at', 'timestamp')
    .addColumn('ends_at', 'timestamp')
    .addColumn('last_used_at', 'timestamp')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('subscriptions_id_index').on('subscriptions').column('id').execute()
}
