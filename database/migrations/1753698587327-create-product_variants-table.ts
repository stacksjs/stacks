import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('product_variants')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('uuid', 'uuid', col => col.defaultTo(sql.raw('gen_random_uuid()')))
    .addColumn('variant', 'varchar(100)', col => col.notNull())
    .addColumn('type', 'varchar(50)', col => col.notNull())
    .addColumn('description', 'varchar(255)')
    .addColumn('options', 'varchar(255)')
    .addColumn('status', 'varchar(255)', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('product_variants_id_index').on('product_variants').column('id').execute()
}
