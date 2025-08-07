import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('posts')
    .addColumn('author_id', 'integer', col =>
      col.references('authors.id').onDelete('cascade'))
    .execute()
  await db.schema.createIndex('posts_author_id_index').on('posts').column('author_id').execute()
}
