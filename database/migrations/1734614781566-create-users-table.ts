import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('users')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('email', 'varchar(255)', col => col.unique().notNull())
    .addColumn('name', 'varchar(255)', col => col.notNull())
    .addColumn('password', 'varchar(255)', col => col.notNull())
    .addColumn('job_title', 'varchar(255)', col => col.notNull())
    .addColumn('stripe_id', 'varchar(255)')
    .addColumn('team_id', 'integer', col =>
      col.references('teams.id').onDelete('cascade'))
    .addColumn('deployment_id', 'integer', col =>
      col.references('deployments.id').onDelete('cascade'))
    .addColumn('post_id', 'integer', col =>
      col.references('posts.id').onDelete('cascade'))
    .addColumn('paymentmethod_id', 'integer', col =>
      col.references('payment_methods.id').onDelete('cascade'))
    .addColumn('transaction_id', 'integer', col =>
      col.references('transactions.id').onDelete('cascade'))
    .addColumn('subscription_id', 'integer', col =>
      col.references('subscriptions.id').onDelete('cascade'))
    .addColumn('public_passkey', 'text')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
