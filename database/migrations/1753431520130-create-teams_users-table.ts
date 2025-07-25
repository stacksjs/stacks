import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('teams_users')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) => col.notNull())
    .addColumn('team_id', 'integer', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .execute()

  await db.schema
    .alterTable('teams_users')
    .addForeignKeyConstraint('teams_users_user_id_fkey', ['user_id'], 'teams', ['id'], (cb) => cb.onDelete('cascade'))
    .execute()

  await db.schema
    .alterTable('teams_users')
    .addUniqueConstraint('teams_users_unique', ['user_id', 'team_id'])
    .execute()

  await db.schema
    .createIndex('teams_users_user_id_idx')
    .on('teams_users')
    .column('user_id')
    .execute()

  await db.schema
    .createIndex('teams_users_team_id_idx')
    .on('teams_users')
    .column('team_id')
    .execute()
}
