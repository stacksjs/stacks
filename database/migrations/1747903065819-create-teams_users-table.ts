import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('teams_users')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('team_id', 'integer')
    .addColumn('user_id', 'integer')
    .addColumn('created_at', 'timestamp', col => col.defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .execute()
}
