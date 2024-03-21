import process from 'node:process'
import type { Kysely } from 'kysely'
import { sql } from 'kysely'
import { ExitCode } from '@stacksjs/types'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('users')
    .addColumn('id', 'integer', col => col.primaryKey())
    .addColumn('name', 'text', col => col.defaultTo('test').notNull())
    .addColumn('email', 'text', col => col.defaultTo('test email').unique().notNull())
    .addColumn('password', 'text', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute()
}

process.exit(ExitCode.Success)
