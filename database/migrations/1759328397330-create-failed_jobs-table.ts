import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('failed_jobs')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('connection', 'text', col => col.notNull())
    .addColumn('queue', 'text', col => col.notNull())
    .addColumn('payload', 'text', col => col.notNull())
    .addColumn('exception', 'text', col => col.notNull())
    .addColumn('failed_at', 'date')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('failed_jobs_id_index').on('failed_jobs').column('id').execute()
}
