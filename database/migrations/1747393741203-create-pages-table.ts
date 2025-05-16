import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('pages')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('title', 'varchar(255)', col => col.notNull())
    .addColumn('template', 'varchar(255)', col => col.notNull())
    .addColumn('views', 'double', col => col.defaultTo(0))
    .addColumn('conversions', 'double', col => col.defaultTo(0))
    .addColumn('published_at', 'double')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('pages_id_index').on('pages').column('id').execute()
}
