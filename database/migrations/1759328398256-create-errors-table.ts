import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('errors')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('type', 'text', col => col.notNull())
    .addColumn('message', 'text', col => col.notNull())
    .addColumn('stack', 'text')
    .addColumn('status', 'integer')
    .addColumn('additional_info', 'text')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('errors_id_index').on('errors').column('id').execute()
}
