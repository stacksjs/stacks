import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('deployments')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('commit_sha', 'varchar(255)', col => col.unique())
    .addColumn('commit_message', 'varchar(255)')
    .addColumn('branch', 'varchar(255)')
    .addColumn('status', 'varchar(255)')
    .addColumn('execution_time', 'integer')
    .addColumn('deploy_script', 'varchar(255)')
    .addColumn('terminal_output', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('deployments_id_index').on('deployments').column('id').execute()
}
