import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('failed_jobs')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('connection', 'varchar(100)', col => col.notNull())
    .addColumn('queue', 'varchar(255)', col => col.notNull())
    .addColumn('payload', 'varchar(255)', col => col.notNull())
    .addColumn('exception', 'varchar(255)', col => col.notNull())
    .addColumn('failed_at', 'date')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('failed_jobs_id_index').on('failed_jobs').column('id').execute()
}
