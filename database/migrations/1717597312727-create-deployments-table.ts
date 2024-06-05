import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('deployments')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('commitSha', 'varchar(512)', col => col.unique())
    .addColumn('commitMessage', 'varchar(255)')
    .addColumn('branch', 'varchar(255)')
    .addColumn('status', 'varchar(255)')
    .addColumn('executionTime', 'integer')
    .addColumn('deployScript', 'varchar(255)')
    .addColumn('terminalOutput', 'varchar(255)')
    .addColumn('user_id', 'integer', (col) =>
        col.references('users.id').onDelete('cascade')
      ) 
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
