import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('logs')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('timestamp', 'integer')
    .addColumn('type', sql`enum('warning', 'error', 'info', 'success')`)
    .addColumn('source', sql`enum('file', 'cli', 'system')`)
    .addColumn('message', 'varchar(1000)')
    .addColumn('project', 'varchar(255)')
    .addColumn('stacktrace', 'varchar(5000)')
    .addColumn('file', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('logs_id_index').on('logs').column('id').execute()
}
