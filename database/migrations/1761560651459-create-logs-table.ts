import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('logs')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('timestamp', 'integer', col => col.notNull())
    .addColumn('type', 'varchar(255)', col => col.notNull())
    .addColumn('source', 'varchar(255)', col => col.notNull())
    .addColumn('message', 'varchar(1000)', col => col.notNull())
    .addColumn('project', 'varchar(255)', col => col.notNull())
    .addColumn('stacktrace', 'varchar(5000)', col => col.notNull())
    .addColumn('file', 'varchar(255)', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('logs_id_index').on('logs').column('id').execute()
}
