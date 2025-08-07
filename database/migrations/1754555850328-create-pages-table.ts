import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('pages')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('uuid', 'uuid', (col) => col.defaultTo(sql.raw('gen_random_uuid()')))
    .addColumn('title', 'varchar(255)')
    .addColumn('template', 'varchar(255)')
    .addColumn('views', 'integer', col => col.defaultTo(0))
    .addColumn('conversions', 'integer', col => col.defaultTo(0))
    .addColumn('published_at', 'timestamp')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('pages_id_index').on('pages').column('id').execute()
}
