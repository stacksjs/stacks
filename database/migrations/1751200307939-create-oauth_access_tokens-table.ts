import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('oauth_access_tokens')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('token', 'varchar(512)', col => col.notNull())
    .addColumn('name', 'varchar(512)')
    .addColumn('scopes', 'varchar(190)')
    .addColumn('revoked', 'boolean', col => col.notNull())
    .addColumn('expires_at', 'datetime')
    .addColumn('oauth_client_id', 'integer', col =>
      col.references('oauth_clients.id').onDelete('cascade'))
    .addColumn('user_id', 'integer', col =>
      col.references('users.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('oauth_access_tokens_oauth_client_id_index').on('oauth_access_tokens').column('oauth_client_id').execute()

  await db.schema.createIndex('oauth_access_tokens_user_id_index').on('oauth_access_tokens').column('user_id').execute()

  await db.schema.createIndex('oauth_access_tokens_id_index').on('oauth_access_tokens').column('id').execute()
}
