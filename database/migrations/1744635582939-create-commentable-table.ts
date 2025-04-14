import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('commentable')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('title', 'varchar(255)', col => col.notNull())
    .addColumn('body', 'text', col => col.notNull())
    .addColumn('status', 'varchar(50)', col => col.notNull().defaultTo('approved'))
    .addColumn('approved_at', 'integer')
    .addColumn('rejected_at', 'integer')
    .addColumn('commentable_id', 'integer', col => col.notNull())
    .addColumn('commentable_type', 'varchar(255)', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('idx_commenteable_status').on('commentable').column('status').execute()
  await db.schema.createIndex('idx_commenteable_commentable').on('commentable').columns(['commentable_id', 'commentable_type']).execute()
}
