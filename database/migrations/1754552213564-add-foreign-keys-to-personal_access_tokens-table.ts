import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('personal_access_tokens')
    .addColumn('team_id', 'integer', (col) =>
      col.references('teams.id').onDelete('cascade')
    ) 
    .addColumn('user_id', 'integer', (col) =>
      col.references('users.id').onDelete('cascade')
    ) 
    .execute()
  await db.schema.createIndex('personal_access_tokens_team_id_index').on('personal_access_tokens').column('team_id').execute()

  await db.schema.createIndex('personal_access_tokens_user_id_index').on('personal_access_tokens').column('user_id').execute()

}
