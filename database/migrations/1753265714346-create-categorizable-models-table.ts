import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('categorizable_models')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('category_id', 'integer', col => col.notNull())
    .addColumn('categorizable_id', 'integer', col => col.notNull())
    .addColumn('categorizable_type', 'varchar(255)', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema
    .createIndex('idx_categorizable_models_category')
    .on('categorizable_models')
    .column('category_id')
    .execute()

  await db.schema
    .createIndex('idx_categorizable_models_polymorphic')
    .on('categorizable_models')
    .columns(['categorizable_id', 'categorizable_type'])
    .execute()

  await db.schema
    .createIndex('idx_categorizable_models_unique')
    .on('categorizable_models')
    .columns(['category_id', 'categorizable_id', 'categorizable_type'])
    .unique()
    .execute()

}
