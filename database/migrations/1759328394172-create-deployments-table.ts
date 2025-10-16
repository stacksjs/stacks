import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('deployments')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('commit_sha', 'text', col => col.unique())
    .addColumn('commit_message', 'text')
    .addColumn('branch', 'text')
    .addColumn('status', 'text')
    .addColumn('execution_time', 'integer')
    .addColumn('deploy_script', 'text')
    .addColumn('terminal_output', 'text')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('deployments_id_index').on('deployments').column('id').execute()
}
