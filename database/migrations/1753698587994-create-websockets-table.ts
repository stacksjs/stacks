import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('websockets')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('type', 'varchar(255)')
    .addColumn('socket', 'varchar(255)')
    .addColumn('details', 'varchar(1000)')
    .addColumn('time', 'integer')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('websockets_id_index').on('websockets').column('id').execute()
}
