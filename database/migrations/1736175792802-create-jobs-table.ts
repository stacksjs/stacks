import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('jobs')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('queue', 'varchar(255)', col => col.notNull())
    .addColumn('payload', 'text', col => col.notNull())
    .addColumn('attempts', 'integer', col => col.notNull().defaultTo(0))
    .addColumn('reserved_at', 'timestamp')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
