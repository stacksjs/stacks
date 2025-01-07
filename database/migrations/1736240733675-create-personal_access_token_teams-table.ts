import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('personal_access_token_teams')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('team_id', 'integer')
    .addColumn('personal_access_token_id', 'integer')
    .execute()
}
