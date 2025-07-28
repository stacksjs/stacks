import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('manufacturers')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('uuid', 'uuid', col => col.defaultTo(sql.raw('gen_random_uuid()')))
    .addColumn('manufacturer', 'varchar(100)', col => col.notNull().unique())
    .addColumn('description', 'varchar(2000)')
    .addColumn('country', 'varchar(100)', col => col.notNull())
    .addColumn('featured', 'boolean')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('manufacturers_id_index').on('manufacturers').column('id').execute()
}
