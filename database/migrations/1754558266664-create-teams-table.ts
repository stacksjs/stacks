import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('teams')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('name', 'varchar(255)', col => col.notNull())
    .addColumn('company_name', 'varchar(255)', col => col.notNull())
    .addColumn('email', 'varchar(255)', col => col.notNull())
    .addColumn('billing_email', 'varchar(255)', col => col.notNull())
    .addColumn('status', 'varchar(255)', col => col.notNull())
    .addColumn('description', 'varchar(255)', col => col.notNull())
    .addColumn('path', 'varchar(255)', col => col.notNull())
    .addColumn('is_personal', 'boolean', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('teams_id_index').on('teams').column('id').execute()
}
