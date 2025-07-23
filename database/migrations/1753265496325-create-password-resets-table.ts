import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('password_resets')
    .addColumn('email', 'varchar(255)', col => col.notNull())
    .addColumn('token', 'varchar(255)', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .execute()

  await db.schema
    .createIndex('password_resets_email_index')
    .on('password_resets')
    .column('email')
    .execute()

  await db.schema
    .createIndex('password_resets_token_index')
    .on('password_resets')
    .column('token')
    .execute()
}
