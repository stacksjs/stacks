import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('oauth_access_tokens')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('client_id', 'integer', col => col.notNull())
    .addColumn('name', 'varchar(191)')
    .addColumn('scopes', 'varchar(255)')
    .addColumn('revoked', 'boolean', col => col.notNull())
    .addColumn('expires_at', 'timestamp')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('oauth_access_tokens_id_index').on('oauth_access_tokens').column('id').execute()
}
