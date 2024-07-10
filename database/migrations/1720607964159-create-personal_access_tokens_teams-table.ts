import type { Database } from '@stacksjs/database'
export async function up(db: Database<any>) {
  await db.schema
    .createTable('personal_access_tokens_teams')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('teams_id', 'integer')
    .addColumn('accesstoken_id', 'integer')
    .execute()
    }
