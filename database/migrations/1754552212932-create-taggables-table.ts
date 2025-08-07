import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('taggables')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('name', 'varchar(255)', col => col.notNull())
    .addColumn('slug', 'varchar(255)', col => col.notNull().unique())
    .addColumn('type', 'varchar(255)')
    .addColumn('color', 'varchar(255)')
    .addColumn('description', 'text')
    .addColumn('is_active', 'boolean', col => col.defaultTo(true))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema
    .createIndex('idx_taggables_slug')
    .on('taggables')
    .column('slug')
    .execute()

  await db.schema
    .createIndex('idx_taggables_type')
    .on('taggables')
    .column('type')
    .execute()

  await db.schema
    .createIndex('idx_taggables_name')
    .on('taggables')
    .column('name')
    .execute()

}
