import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('failed_jobs')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('connection', 'varchar(100)')
    .addColumn('queue', 'varchar(255)')
    .addColumn('payload', 'varchar(255)')
    .addColumn('exception', 'varchar(255)')
    .addColumn('failed_at', 'date')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('failed_jobs_id_index').on('failed_jobs').column('id').execute()
}
