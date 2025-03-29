import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('print_logs')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('printer', 'text', col => col.notNull())
    .addColumn('document', 'text', col => col.notNull())
    .addColumn('timestamp', 'text', col => col.notNull())
    .addColumn('status', 'text', col => col.notNull())
    .addColumn('size', 'numeric')
    .addColumn('pages', 'numeric')
    .addColumn('duration', 'numeric')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
