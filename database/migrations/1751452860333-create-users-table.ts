import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('users')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('github_id', 'varchar(255)')
    .addColumn('email', 'varchar(255)', col => col.notNull().unique())
    .addColumn('name', 'varchar(100)', col => col.notNull())
    .addColumn('password', 'varchar(255)', col => col.notNull())
    .addColumn('team_id', 'integer', col =>
      col.references('teams.id').onDelete('cascade'))
    .addColumn('public_passkey', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('users_email_name_index').on('users').columns(['email', 'name']).execute()
  await db.schema.createIndex('users_team_id_index').on('users').column('team_id').execute()

  await db.schema.createIndex('users_id_index').on('users').column('id').execute()
}
