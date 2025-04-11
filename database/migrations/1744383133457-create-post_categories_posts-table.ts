import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('post_categories_posts')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('post_category_id', 'integer')
    .addColumn('post_id', 'integer')
    .addColumn('created_at', 'timestamp', col => col.defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .execute()
}
