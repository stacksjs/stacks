import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('categorizable')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('name', 'varchar(255)', col => col.notNull())
    .addColumn('slug', 'varchar(255)', col => col.notNull().unique())
    .addColumn('description', 'text')
    .addColumn('order', 'integer', col => col.defaultTo(0))
    .addColumn('is_active', 'boolean', col => col.defaultTo(true))
    .addColumn('categorizable_id', 'integer', col => col.notNull())
    .addColumn('categorizable_type', 'varchar(255)', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema
    .createIndex('categorizable_id_index')
    .on('categorizable')
    .column('id')
    .execute()

  await db.schema
    .createIndex('categorizable_slug_index')
    .on('categorizable')
    .column('slug')
    .execute()

  await db.schema
    .createIndex('categorizable_polymorphic_index')
    .on('categorizable')
    .columns(['categorizable_id', 'categorizable_type'])
    .execute()

  await db.schema
    .createIndex('categorizable_order_index')
    .on('categorizable')
    .column('order')
    .execute()

  await db.schema
    .createIndex('categorizable_is_active_index')
    .on('categorizable')
    .column('is_active')
    .execute()
}
