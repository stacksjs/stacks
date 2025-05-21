import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('taggable_models')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('tag_id', 'integer', col => col.notNull())
    .addColumn('taggable_id', 'integer', col => col.notNull())
    .addColumn('taggable_type', 'varchar(255)', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema
    .createIndex('idx_taggable_models_tag')
    .on('taggable_models')
    .column('tag_id')
    .execute()

  await db.schema
    .createIndex('idx_taggable_models_polymorphic')
    .on('taggable_models')
    .columns(['taggable_id', 'taggable_type'])
    .execute()

  await db.schema
    .createIndex('idx_taggable_models_unique')
    .on('taggable_models')
    .columns(['tag_id', 'taggable_id', 'taggable_type'])
    .unique()
    .execute()
}
