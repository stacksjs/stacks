import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('post_categories')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('description', 'text', col => col.notNull())
    .addColumn('slug', 'text', col => col.unique().notNull())
    .addColumn('post_id', 'integer', col =>
      col.references('posts.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('post_categories_post_id_index').on('post_categories').column('post_id').execute()

  await db.schema.createIndex('post_categories_id_index').on('post_categories').column('id').execute()
}
