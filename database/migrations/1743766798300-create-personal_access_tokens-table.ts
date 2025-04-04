import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('personal_access_tokens')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('token', 'text', col => col.unique().notNull())
    .addColumn('plain_text_token', 'text', col => col.notNull())
    .addColumn('abilities', 'text', col => col.notNull())
    .addColumn('last_used_at', 'text')
    .addColumn('expires_at', 'text')
    .addColumn('revoked_at', 'text')
    .addColumn('ip_address', 'text')
    .addColumn('device_name', 'text')
    .addColumn('is_single_use', 'integer')
    .addColumn('team_id', 'integer', (col) =>
        col.references('teams.id').onDelete('cascade')
      ) 
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('personal_access_tokens_team_id_index').on('personal_access_tokens').column('team_id').execute()

  await db.schema.createIndex('personal_access_tokens_id_index').on('personal_access_tokens').column('id').execute()
}
