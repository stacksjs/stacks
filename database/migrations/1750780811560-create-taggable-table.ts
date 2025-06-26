import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('taggables')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('name', 'varchar(255)', col => col.notNull())
    .addColumn('slug', 'varchar(255)', col => col.notNull().unique())
    .addColumn('description', 'text')
    .addColumn('is_active', 'boolean', col => col.defaultTo(true))
    .addColumn('taggable_type', 'varchar(255)', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema
    .createIndex('idx_taggable_slug')
    .on('taggables')
    .column('slug')
    .execute()

  await db.schema
    .createIndex('idx_taggable_polymorphic')
    .on('taggables')
    .columns(['taggable_type'])
    .execute()
}
