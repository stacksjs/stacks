import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('requests')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('method', 'text')
    .addColumn('path', 'text')
    .addColumn('status_code', 'integer')
    .addColumn('duration_ms', 'integer')
    .addColumn('ip_address', 'text')
    .addColumn('memory_usage', 'integer')
    .addColumn('user_agent', 'text')
    .addColumn('error_message', 'text')
    .addColumn('deleted_at', 'timestamp')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('requests_id_index').on('requests').column('id').execute()
}
