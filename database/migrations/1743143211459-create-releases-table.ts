import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('releases')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('version', 'text', col => col.unique().notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
