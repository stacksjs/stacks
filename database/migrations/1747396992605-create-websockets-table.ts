import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('websockets')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('type', sql`enum('disconnection', 'error', 'success')`, col => col.notNull())
    .addColumn('socket', 'varchar(255)', col => col.notNull())
    .addColumn('details', 'varchar(255)', col => col.notNull())
    .addColumn('time', 'integer', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('websockets_id_index').on('websockets').column('id').execute()
}
