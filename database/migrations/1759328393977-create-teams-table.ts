import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('teams')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('company_name', 'text', col => col.notNull())
    .addColumn('email', 'text', col => col.notNull())
    .addColumn('billing_email', 'text', col => col.notNull())
    .addColumn('status', 'text', col => col.notNull())
    .addColumn('description', 'text', col => col.notNull())
    .addColumn('path', 'text', col => col.notNull())
    .addColumn('is_personal', 'boolean', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('teams_id_index').on('teams').column('id').execute()
}
