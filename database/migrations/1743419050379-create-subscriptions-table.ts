import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('subscriptions')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('type', 'text', col => col.notNull())
    .addColumn('plan', 'text')
    .addColumn('provider_id', 'text', col => col.unique().notNull())
    .addColumn('provider_status', 'text', col => col.notNull())
    .addColumn('unit_price', 'numeric')
    .addColumn('provider_type', 'text', col => col.notNull())
    .addColumn('provider_price_id', 'text')
    .addColumn('quantity', 'numeric')
    .addColumn('trial_ends_at', 'text')
    .addColumn('ends_at', 'text')
    .addColumn('last_used_at', 'text')
    .addColumn('user_id', 'integer', col =>
      col.references('users.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('subscriptions_user_id_index').on('subscriptions').column('user_id').execute()
}
