import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('cart_items')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('quantity', 'integer', col => col.notNull())
    .addColumn('unit_price', 'integer', col => col.notNull())
    .addColumn('total_price', 'integer', col => col.notNull())
    .addColumn('tax_rate', 'integer')
    .addColumn('tax_amount', 'integer')
    .addColumn('discount_percentage', 'integer')
    .addColumn('discount_amount', 'integer')
    .addColumn('product_name', 'varchar(255)', col => col.notNull())
    .addColumn('product_sku', 'varchar(100)')
    .addColumn('product_image', 'varchar(255)')
    .addColumn('notes', 'varchar(500)')
    .addColumn('cart_id', 'integer', col =>
      col.references('carts.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('cart_items_cart_id_index').on('cart_items').column('cart_id').execute()

  await db.schema.createIndex('cart_items_id_index').on('cart_items').column('id').execute()
}
