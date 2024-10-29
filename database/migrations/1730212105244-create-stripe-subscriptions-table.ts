import type { Database } from '@stacksjs/database'
 import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('subscriptions')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('user_id', 'integer', col => col.notNull())
    .addColumn('type', 'varchar(255)', col => col.notNull())
    .addColumn('stripe_id', 'varchar(255)', col => col.notNull().unique())
    .addColumn('stripe_status', 'varchar(255)', col => col.notNull())
    .addColumn('stripe_price', 'varchar(255)')
    .addColumn('quantity', 'integer')
    .addColumn('trial_ends_at', 'timestamp')
    .addColumn('ends_at', 'timestamp')
    .addColumn('last_used_at', 'text')
    .addColumn('updated_at', 'timestamp', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .execute()
    }
