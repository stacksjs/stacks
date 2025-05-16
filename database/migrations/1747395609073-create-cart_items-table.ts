import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('cart_items')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('quantity', 'double', col => col.notNull())
    .addColumn('unit_price', 'double', col => col.notNull())
    .addColumn('total_price', 'double', col => col.notNull())
    .addColumn('tax_rate', 'double')
    .addColumn('tax_amount', 'double')
    .addColumn('discount_percentage', 'double')
    .addColumn('discount_amount', 'double')
    .addColumn('product_name', 'varchar(255)', col => col.notNull())
    .addColumn('product_sku', 'varchar(255)')
    .addColumn('product_image', 'varchar(255)')
    .addColumn('notes', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('cart_items_id_index').on('cart_items').column('id').execute()
}
