import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('logs')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('timestamp', 'integer', col => col.notNull())
    .addColumn('type', 'text', col => col.notNull())
    .addColumn('source', 'text', col => col.notNull())
    .addColumn('message', 'text', col => col.notNull())
    .addColumn('project', 'text', col => col.notNull())
    .addColumn('stacktrace', 'text', col => col.notNull())
    .addColumn('file', 'text', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('logs_id_index').on('logs').column('id').execute()
}
