import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('manufacturers')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('manufacturer', 'text', col => col.notNull().unique())
    .addColumn('description', 'text')
    .addColumn('country', 'text', col => col.notNull())
    .addColumn('featured', 'boolean')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('manufacturers_id_index').on('manufacturers').column('id').execute()
}
