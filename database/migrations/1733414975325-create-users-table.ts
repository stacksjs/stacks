import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('users')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('email', 'varchar(255)', col => col.unique().notNull())
    .addColumn('password', 'varchar(255)', col => col.notNull())
    .addColumn('name', 'varchar(255)', col => col.notNull())
    .addColumn('job_title', 'varchar(255)', col => col.notNull())
    .addColumn('stripe_id', 'varchar(255)')
    .addColumn('deployment_id', 'integer', (col) =>
        col.references('undefined.id').onDelete('cascade')
      ) 
    .addColumn('post_id', 'integer', (col) =>
        col.references('undefined.id').onDelete('cascade')
      ) 
    .addColumn('public_passkey', 'text')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
