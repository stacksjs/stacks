import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('commentables')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('comment_id', 'integer', col => col.notNull())
    .addColumn('commentable_id', 'integer', col => col.notNull())
    .addColumn('commentable_type', 'varchar(255)', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema
    .alterTable('commentables')
    .addForeignKeyConstraint('commentables_comment_id_foreign', ['comment_id'], 'comments', ['id'], cb => cb.onDelete('cascade'))
    .execute()

  await db.schema
    .createIndex('idx_commentables_comment')
    .on('commentables')
    .column('comment_id')
    .execute()

  await db.schema
    .createIndex('idx_commentables_polymorphic')
    .on('commentables')
    .columns(['commentable_id', 'commentable_type'])
    .execute()

  await db.schema
    .createIndex('idx_commentables_unique')
    .on('commentables')
    .columns(['comment_id', 'commentable_id', 'commentable_type'])
    .unique()
    .execute()
}
