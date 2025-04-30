import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('posts')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('title', 'text', col => col.notNull())
    .addColumn('poster', 'text')
    .addColumn('body', 'text', col => col.notNull())
    .addColumn('views', 'numeric', col => col.defaultTo(0))
    .addColumn('published_at', 'numeric', col => col.notNull())
    .addColumn('status', 'text', col => col.notNull().defaultTo('draft'))
    .addColumn('user_id', 'integer', col =>
      col.references('users.id').onDelete('cascade'))
    .addColumn('author_id', 'integer', col =>
      col.references('authors.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('posts_user_id_index').on('posts').column('user_id').execute()

  await db.schema.createIndex('posts_author_id_index').on('posts').column('author_id').execute()

  await db.schema.createIndex('posts_id_index').on('posts').column('id').execute()
}
