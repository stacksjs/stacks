import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('categories')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('description', 'text')
    .addColumn('slug', 'text', col => col.notNull())
    .addColumn('image_url', 'text')
    .addColumn('is_active', 'boolean')
    .addColumn('parent_category_id', 'text')
    .addColumn('display_order', 'integer', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('categories_id_index').on('categories').column('id').execute()
}
