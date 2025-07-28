import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('personal_access_tokens')
    .addColumn('team_id', 'integer', col =>
      col.references('teams.id').onDelete('cascade'))
    .addColumn('user_id', 'integer', col =>
      col.references('users.id').onDelete('cascade'))
    .execute()
}
