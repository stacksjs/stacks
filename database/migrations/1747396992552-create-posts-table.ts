import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('posts')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('title', 'varchar(255)', col => col.notNull())
    .addColumn('poster', 'varchar(255)')
    .addColumn('content', 'varchar(255)', col => col.notNull())
    .addColumn('excerpt', 'varchar(255)')
    .addColumn('views', 'integer', col => col.defaultTo(0))
    .addColumn('published_at', 'integer')
    .addColumn('status', sql`enum('published', 'draft', 'archived')`, col => col.notNull().defaultTo('draft'))
    .addColumn('is_featured', 'integer')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('posts_id_index').on('posts').column('id').execute()
}
