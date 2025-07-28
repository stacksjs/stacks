import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('commentables')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('title', 'varchar(255)', col => col.notNull())
    .addColumn('body', 'text', col => col.notNull())
    .addColumn('status', 'varchar(50)', col => col.notNull().defaultTo('pending'))
    .addColumn('approved_at', 'integer')
    .addColumn('rejected_at', 'integer')
    .addColumn('commentables_id', 'integer', col => col.notNull())
    .addColumn('commentables_type', 'varchar(255)', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('idx_commenteable_status').on('commentables').column('status').execute()
  await db.schema.createIndex('idx_commenteable_commentables').on('commentables').columns(['commentables_id', 'commentables_type']).execute()
}
