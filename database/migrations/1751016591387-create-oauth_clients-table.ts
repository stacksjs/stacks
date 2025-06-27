import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('oauth_clients')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('name', 'varchar(191)')
    .addColumn('secret', 'varchar(100)')
    .addColumn('provider', 'varchar(191)')
    .addColumn('redirect', 'varchar(191)')
    .addColumn('personal_access_client', 'boolean')
    .addColumn('password_client', 'boolean')
    .addColumn('revoked', 'boolean')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('oauth_clients_id_index').on('oauth_clients').column('id').execute()
}
