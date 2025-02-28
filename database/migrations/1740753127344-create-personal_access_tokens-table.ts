import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('personal_access_tokens')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('name', 'text')
    .addColumn('token', 'text', col => col.unique())
    .addColumn('plain_text_token', 'text')
    .addColumn('abilities', 'text')
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
}
