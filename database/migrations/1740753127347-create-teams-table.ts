import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('teams')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('name', 'text')
    .addColumn('company_name', 'text')
    .addColumn('email', 'text')
    .addColumn('billing_email', 'text')
    .addColumn('status', 'text')
    .addColumn('description', 'text')
    .addColumn('path', 'text')
    .addColumn('is_personal', 'integer')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
