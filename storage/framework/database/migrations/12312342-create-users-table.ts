import process from 'node:process'
import { db } from 'src/database/src'
import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'integer', col => col.primaryKey())
    .addColumn('name', 'varchar(255)')
    .addColumn('email', 'varchar(255)', col => col.notNull())
    .addColumn('password', 'varchar(255)', col => col.notNull())
    .addColumn('created_at', 'timestamp', col =>
      col.defaultTo(sql`now()`).notNull())
    .execute()
}

await up(db)
process.exit(0)
