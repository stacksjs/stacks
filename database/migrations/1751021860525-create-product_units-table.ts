import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('product_units')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('name', 'varchar(100)', col => col.notNull())
    .addColumn('abbreviation', 'varchar(10)', col => col.notNull())
    .addColumn('type', 'varchar(255)', col => col.notNull())
    .addColumn('description', 'varchar(255)')
    .addColumn('is_default', 'boolean')
    .addColumn('product_id', 'integer', col =>
      col.references('products.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('product_units_product_id_index').on('product_units').column('product_id').execute()

  await db.schema.createIndex('product_units_id_index').on('product_units').column('id').execute()
}
