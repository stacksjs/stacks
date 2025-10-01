import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('subscriptions')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('type', 'text', col => col.notNull())
    .addColumn('plan', 'text')
    .addColumn('provider_id', 'text', col => col.notNull().unique())
    .addColumn('provider_status', 'text', col => col.notNull())
    .addColumn('unit_price', 'integer', col => col.notNull())
    .addColumn('provider_type', 'text', col => col.notNull())
    .addColumn('provider_price_id', 'text')
    .addColumn('quantity', 'integer')
    .addColumn('trial_ends_at', 'timestamp')
    .addColumn('ends_at', 'timestamp')
    .addColumn('last_used_at', 'timestamp')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('subscriptions_id_index').on('subscriptions').column('id').execute()
}
