import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('query_logs')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('query', 'text', col => col.notNull())
    .addColumn('normalized_query', 'text')
    .addColumn('duration', 'integer')
    .addColumn('connection', 'varchar(255)')
    .addColumn('status', 'varchar(50)')
    .addColumn('executed_at', 'timestamp', col => col.notNull())
    .addColumn('model', 'varchar(255)')
    .addColumn('method', 'varchar(255)')
    .addColumn('rows_affected', 'integer')
    .addColumn('optimization_suggestions', 'json')
    .addColumn('affected_tables', 'json')
    .addColumn('indexes_used', 'json')
    .addColumn('missing_indexes', 'json')
    .addColumn('tags', 'json')
    .addColumn('bindings', 'json')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema
    .createIndex('idx_query_logs_executed_at')
    .on('query_logs')
    .column('executed_at')
    .execute()

  await db.schema
    .createIndex('idx_query_logs_status')
    .on('query_logs')
    .column('status')
    .execute()

  await db.schema
    .createIndex('idx_query_logs_duration')
    .on('query_logs')
    .column('duration')
    .execute()
}
