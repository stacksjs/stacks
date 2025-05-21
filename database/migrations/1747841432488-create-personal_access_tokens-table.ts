import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('personal_access_tokens')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('name', 'varchar(255)', col => col.notNull())
    .addColumn('token', 'varchar(512)', col => col.unique().notNull())
    .addColumn('plain_text_token', 'varchar(512)', col => col.notNull())
    .addColumn('abilities', sql`enum('read', 'write', 'admin', 'read|write', 'read|admin', 'write|admin', 'read|write|admin')`, col => col.notNull())
    .addColumn('last_used_at', 'timestamp')
    .addColumn('expires_at', 'timestamp')
    .addColumn('revoked_at', 'timestamp')
    .addColumn('ip_address', 'varchar(255)')
    .addColumn('device_name', 'varchar(255)')
    .addColumn('is_single_use', 'boolean')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('personal_access_tokens_id_index').on('personal_access_tokens').column('id').execute()
}
