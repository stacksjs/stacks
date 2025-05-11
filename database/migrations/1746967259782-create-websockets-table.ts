import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('websockets')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('type', 'text', col => col.notNull())
    .addColumn('socket', 'text', col => col.notNull())
    .addColumn('details', 'text', col => col.notNull())
    .addColumn('time', 'numeric', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('websockets_id_index').on('websockets').column('id').execute()
}
