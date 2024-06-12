import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('personal_access_tokens')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('name', 'varchar(255)')
    .addColumn('token', 'varchar(512)', col => col.unique())
    .addColumn('plainTextToken', 'varchar(512)')
    .addColumn('abilities', sql`enum('read', 'write', 'admin', 'read|write', 'read|admin', 'write|admin', 'read|write|admin')`)
    .addColumn('team_id', 'integer', (col) =>
        col.references('teams.id').onDelete('cascade')
      ) 
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
