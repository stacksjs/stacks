import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('passkeys')
    .addColumn('id', 'text')
    .addColumn('cred_public_key', 'text')
    .addColumn('user_id', 'integer')
    .addColumn('webauthn_user_id', 'varchar(255)')
    .addColumn('counter', 'integer')
    .addColumn('device_type', 'varchar(255)')
    .addColumn('credential_type', 'varchar(255)')
    .addColumn('backup_eligible', 'boolean')
    .addColumn('backup_status', 'boolean')
    .addColumn('transports', 'varchar(255)')
    .addColumn('last_used_at', 'text')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .execute()
}
