import type { Database } from '@stacksjs/database'
export async function up(db: Database<any>) {
  await db.schema
    .createTable('teams_users')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('users_id', 'integer')
    .addColumn('team_id', 'integer')
    .execute()
    }
