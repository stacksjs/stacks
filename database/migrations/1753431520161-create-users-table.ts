import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('users')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('uuid', 'text')
    .addColumn('github_id', 'text')
    .addColumn('email', 'varchar(255)', col => col.notNull().unique())
    .addColumn('name', 'varchar(100)', col => col.notNull())
    .addColumn('password', 'varchar(255)', col => col.notNull())
    .addColumn('public_passkey', 'text')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('users_email_name_index').on('users').columns(['email', 'name']).execute()
  await db.schema.createIndex('users_team_id_index').on('users').column('team_id').execute()

  await db.schema.createIndex('users_id_index').on('users').column('id').execute()
}
