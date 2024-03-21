import { now } from '@stacksjs/database'
import type { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'integer', col => col.primaryKey())
    .addColumn('name', 'varchar(255)')
    .addColumn('email', 'varchar(255)', col => col.notNull())
    .addColumn('password', 'varchar(255)', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.defaultTo(now).notNull())
    .execute()
}
