import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('deployments')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('commit_sha', 'text', col => col.unique().notNull())
    .addColumn('commit_message', 'text', col => col.notNull())
    .addColumn('branch', 'text', col => col.notNull())
    .addColumn('status', 'text', col => col.notNull())
    .addColumn('execution_time', 'numeric', col => col.notNull())
    .addColumn('deploy_script', 'text', col => col.notNull())
    .addColumn('terminal_output', 'text', col => col.notNull())
    .addColumn('user_id', 'integer', col =>
      col.references('users.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('deployments_user_id_index').on('deployments').column('user_id').execute()

  await db.schema.createIndex('deployments_id_index').on('deployments').column('id').execute()
}
