import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('posts')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('title', 'text', col => col.notNull())
    .addColumn('poster', 'text')
    .addColumn('content', 'text', col => col.notNull())
    .addColumn('excerpt', 'text')
    .addColumn('views', 'text', col => col.defaultTo(0))
    .addColumn('published_at', 'text')
    .addColumn('status', 'text', col => col.notNull().defaultTo('draft'))
    .addColumn('is_featured', 'text')
    .addColumn('author_id', 'integer', col =>
      col.references('authors.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('posts_author_id_index').on('posts').column('author_id').execute()

  await db.schema.createIndex('posts_id_index').on('posts').column('id').execute()
}
