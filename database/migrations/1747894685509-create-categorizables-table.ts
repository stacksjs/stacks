import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('categorizables')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('name', 'varchar(255)', col => col.notNull())
    .addColumn('slug', 'varchar(255)', col => col.notNull().unique())
    .addColumn('description', 'text')
    .addColumn('is_active', 'boolean', col => col.defaultTo(true))
    .addColumn('categorizable_type', 'varchar(255)', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema
    .createIndex('categorizables_id_index')
    .on('categorizables')
    .column('id')
    .execute()

  await db.schema
    .createIndex('categorizables_slug_index')
    .on('categorizables')
    .column('slug')
    .execute()

  await db.schema
    .createIndex('categorizables_polymorphic_index')
    .on('categorizables')
    .columns(['categorizable_type'])
    .execute()

  await db.schema
    .createIndex('categorizables_is_active_index')
    .on('categorizables')
    .column('is_active')
    .execute()
}
