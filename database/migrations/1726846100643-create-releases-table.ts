import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('releases')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('version', 'varchar(255)', col => col.unique())
    .addColumn('created_at', 'text', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'text')
    .execute()
}
