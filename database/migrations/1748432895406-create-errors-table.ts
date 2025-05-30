import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('errors')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('type', 'varchar(255)', col => col.notNull())
    .addColumn('message', 'varchar(255)', col => col.notNull())
    .addColumn('stack', 'varchar(255)')
    .addColumn('status', 'integer', col => col.notNull())
    .addColumn('additional_info', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('errors_id_index').on('errors').column('id').execute()
}
