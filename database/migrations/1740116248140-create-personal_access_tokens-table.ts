import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('personal_access_tokens')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('name', 'varchar(255)')
    .addColumn('token', 'varchar(512)', col => col.unique())
    .addColumn('plain_text_token', 'varchar(512)')
    .addColumn('abilities', 'text')
    .addColumn('last_used_at', 'date')
    .addColumn('expires_at', 'date')
    .addColumn('revoked_at', 'date')
    .addColumn('ip_address', 'varchar(255)')
    .addColumn('device_name', 'varchar(255)')
    .addColumn('is_single_use', 'boolean')
    .addColumn('team_id', 'integer', col =>
      col.references('teams.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
