import type { Database } from '@stacksjs/database'
 import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('commenteable_upvotes')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('upvoteable_id', 'integer', col => col.notNull())
    .addColumn('upvoteable_type', 'varchar(255)', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .execute()

  await db.schema.createIndex('idx_commenteable_upvotes_upvoteable').on('commenteable_upvotes').columns(['upvoteable_id', 'upvoteable_type']).execute()
}
