import type { Database } from '@stacksjs/database'
export async function up(db: Database<any>) {
  await db.schema
    .createTable('passkeys')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('cred_public_key', 'text')
    .addColumn('user_id', 'integer')
    .addColumn('webauthn_user_id', 'varchar(255)')
    .addColumn('counter', 'integer')
    .addColumn('backup_eligible', 'boolean')
    .addColumn('backup_status', 'boolean')
    .addColumn('transports', 'varchar(255)')
    .addColumn('created_at', 'text')
    .addColumn('last_used', 'text')
    .execute()
    }
