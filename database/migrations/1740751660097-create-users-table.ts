import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('users')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('email', 'text', col => col.unique().notNull())
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('password', 'text', col => col.notNull())
    .addColumn('job_title', 'text', col => col.notNull())
    .addColumn('stripe_id', 'varchar(255)')
    .addColumn('public_passkey', 'text')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
