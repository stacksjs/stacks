import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('users')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('email', 'varchar(255)', col => col.unique().notNull())
    .addColumn('password', 'varchar(255)', col => col.notNull())
    .addColumn('name', 'varchar(255)', col => col.notNull())
    .addColumn('job_title', 'varchar(255)', col => col.notNull())
    .addColumn('two_factor_secret', 'varchar(255)')
    .addColumn('created_at', 'text', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'text', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()
}
