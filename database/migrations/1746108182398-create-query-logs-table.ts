import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('query_logs')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('query', 'text', col => col.notNull())
    .addColumn('normalized_query', 'text', col => col.notNull())
    .addColumn('duration', 'numeric', col => col.notNull())
    .addColumn('connection', 'text', col => col.notNull())
    .addColumn('status', 'text', col => col.notNull().defaultTo('completed'))
    .addColumn('error', 'text')
    .addColumn('executed_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('bindings', 'text')
    .addColumn('trace', 'text')
    .addColumn('model', 'text')
    .addColumn('method', 'text')
    .addColumn('file', 'text')
    .addColumn('line', 'integer')
    .addColumn('memory_usage', 'numeric', col => col.notNull().defaultTo(0))
    .addColumn('rows_affected', 'integer')
    .addColumn('transaction_id', 'text')
    .addColumn('tags', 'text')
    .addColumn('affected_tables', 'text')
    .addColumn('indexes_used', 'text')
    .addColumn('missing_indexes', 'text')
    .addColumn('explain_plan', 'text')
    .addColumn('optimization_suggestions', 'text')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  // Create indexes for common queries
  await db.schema.createIndex('query_logs_id_index').on('query_logs').column('id').execute()
  await db.schema.createIndex('query_logs_status_index').on('query_logs').column('status').execute()
  await db.schema.createIndex('query_logs_connection_index').on('query_logs').column('connection').execute()
  await db.schema.createIndex('query_logs_executed_at_index').on('query_logs').column('executed_at').execute()
  await db.schema.createIndex('query_logs_duration_index').on('query_logs').column('duration').execute()
}

export async function down(db: Database<any>) {
  await db.schema.dropTable('query_logs').execute()
}