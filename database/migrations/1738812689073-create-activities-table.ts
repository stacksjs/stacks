import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('activities')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('title', 'varchar(255)')
    .addColumn('description', 'varchar(255)')
    .addColumn('address', 'varchar(255)')
    .addColumn('latlng', 'varchar(255)')
    .addColumn('info_source', 'text')
    .addColumn('were_detained', 'boolean')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .addColumn('deleted_at', 'timestamp')
    .execute()
}
