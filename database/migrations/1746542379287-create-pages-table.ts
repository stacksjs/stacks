import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('pages')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('title', 'text', col => col.notNull())
    .addColumn('template', 'text', col => col.notNull())
    .addColumn('views', 'numeric', col => col.defaultTo(0))
    .addColumn('conversions', 'numeric', col => col.defaultTo(0))
    .addColumn('published_at', 'numeric')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('pages_id_index').on('pages').column('id').execute()
}
