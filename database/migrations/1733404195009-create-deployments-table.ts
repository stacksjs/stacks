import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('deployments')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('commit_sha', 'varchar(512)', col => col.unique())
    .addColumn('commit_message', 'varchar(255)')
    .addColumn('branch', 'varchar(255)')
    .addColumn('status', 'varchar(255)')
    .addColumn('execution_time', 'integer')
    .addColumn('deploy_script', 'varchar(255)')
    .addColumn('terminal_output', 'varchar(255)')
    .addColumn('user_id', 'integer', (col) =>
        col.references('undefined.id').onDelete('cascade')
      ) 
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
