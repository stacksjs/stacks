import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('errors')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('type', 'varchar(255)')
    .addColumn('message', 'varchar(255)')
    .addColumn('stack', 'varchar(255)')
    .addColumn('status', 'integer')
    .addColumn('additional_info', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('errors_id_index').on('errors').column('id').execute()
}
