import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('categorizables')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('name', 'varchar(255)', col => col.notNull())
    .addColumn('slug', 'varchar(255)', col => col.notNull().unique())
    .addColumn('description', 'text')
    .addColumn('order', 'integer', col => col.defaultTo(0))
    .addColumn('is_active', 'boolean', col => col.defaultTo(true))
    .addColumn('categorizable_type', 'varchar(255)', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema
    .createIndex('idx_categorizables_slug')
    .on('categorizables')
    .column('slug')
    .execute()

  await db.schema
    .createIndex('idx_categorizables_polymorphic')
    .on('categorizables')
    .columns(['categorizable_type'])
    .execute()

  await db.schema
    .createIndex('idx_categorizables_order')
    .on('categorizables')
    .column('order')
    .execute()

  await db.schema
    .createIndex('idx_categorizables_is_active')
    .on('categorizables')
    .column('is_active')
    .execute()
}
