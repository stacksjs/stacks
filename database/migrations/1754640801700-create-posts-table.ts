import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('posts')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('uuid', 'uuid', col => col.defaultTo(sql.raw('gen_random_uuid()')))
    .addColumn('title', 'varchar(255)')
    .addColumn('poster', 'varchar(255)')
    .addColumn('content', 'varchar(1000)')
    .addColumn('excerpt', 'varchar(500)')
    .addColumn('views', 'integer', col => col.defaultTo(0))
    .addColumn('published_at', 'timestamp')
    .addColumn('status', 'varchar(255)', col => col.defaultTo('draft'))
    .addColumn('is_featured', 'integer')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('posts_id_index').on('posts').column('id').execute()
}
