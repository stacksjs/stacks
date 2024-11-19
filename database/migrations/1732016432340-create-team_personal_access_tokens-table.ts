import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('team_personal_access_tokens')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('team_id', 'integer')
    .addColumn('accesstoken_id', 'integer')
    .execute()
}
