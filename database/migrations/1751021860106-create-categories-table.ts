import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('categories')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('name', 'varchar(50)', col => col.notNull())
    .addColumn('description', 'varchar(255)')
    .addColumn('slug', 'varchar(255)', col => col.notNull())
    .addColumn('image_url', 'varchar(255)')
    .addColumn('is_active', 'boolean')
    .addColumn('parent_category_id', 'varchar(255)')
    .addColumn('display_order', 'integer', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('categories_id_index').on('categories').column('id').execute()
}
