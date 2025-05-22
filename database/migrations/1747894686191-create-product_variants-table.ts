import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('product_variants')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('variant', 'varchar(100)', col => col.notNull())
    .addColumn('type', 'varchar(50)', col => col.notNull())
    .addColumn('description', 'varchar(255)')
    .addColumn('options', 'varchar(255)')
    .addColumn('status', sql`enum('active', 'inactive', 'draft')`, col => col.notNull())
    .addColumn('product_id', 'integer', col =>
      col.references('products.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('product_variants_product_id_index').on('product_variants').column('product_id').execute()

  await db.schema.createIndex('product_variants_id_index').on('product_variants').column('id').execute()
}
