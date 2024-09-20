import type { Database } from '@stacksjs/database'
export async function up(db: Database<any>) {
  await db.schema
    .createTable('user_teams')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('user_id', 'integer')
    .addColumn('team_id', 'integer')
    .execute()
    }
