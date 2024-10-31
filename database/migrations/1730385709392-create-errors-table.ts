import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('errors')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('type', 'varchar(255)', col => col.notNull())
    .addColumn('message', 'text', col => col.notNull())
    .addColumn('stack', 'text')
    .addColumn('status', 'integer', col => col.notNull().defaultTo(0))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .addColumn('user_id', 'integer')
    .addColumn('additional_info', 'text')
    .execute()
}
