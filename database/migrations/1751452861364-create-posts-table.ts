import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('posts')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('title', 'varchar(255)')
    .addColumn('poster', 'varchar(255)')
    .addColumn('content', 'varchar(1000)')
    .addColumn('excerpt', 'varchar(500)')
    .addColumn('views', 'integer', col => col.defaultTo(0))
    .addColumn('published_at', 'timestamp')
    .addColumn('status', sql`enum('published', 'draft', 'archived')`, col => col.defaultTo('draft'))
    .addColumn('is_featured', 'integer')
    .addColumn('author_id', 'integer', col =>
      col.references('authors.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('posts_author_id_index').on('posts').column('author_id').execute()

  await db.schema.createIndex('posts_id_index').on('posts').column('id').execute()
}
