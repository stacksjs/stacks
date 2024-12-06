import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('teams')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('name', 'varchar(255)')
    .addColumn('company_name', 'varchar(255)')
    .addColumn('email', 'varchar(255)')
    .addColumn('billing_email', 'varchar(255)')
    .addColumn('status', 'varchar(255)')
    .addColumn('description', 'varchar(255)')
    .addColumn('path', 'varchar(255)')
    .addColumn('is_personal', 'boolean')
    .addColumn('accesstoken_id', 'integer', (col) =>
        col.references('teams.id').onDelete('cascade')
      ) 
    .addColumn('user_id', 'integer', (col) =>
        col.references('teams.id').onDelete('cascade')
      ) 
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
