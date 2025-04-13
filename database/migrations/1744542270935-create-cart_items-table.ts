import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('cart_items')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('quantity', 'numeric', col => col.notNull())
    .addColumn('unit_price', 'numeric', col => col.notNull())
    .addColumn('total_price', 'numeric', col => col.notNull())
    .addColumn('tax_rate', 'numeric')
    .addColumn('tax_amount', 'numeric')
    .addColumn('discount_percentage', 'numeric')
    .addColumn('discount_amount', 'numeric')
    .addColumn('product_name', 'text', col => col.notNull())
    .addColumn('product_sku', 'text')
    .addColumn('product_image', 'text')
    .addColumn('notes', 'text')
    .addColumn('cart_id', 'integer', (col) =>
        col.references('carts.id').onDelete('cascade')
      ) 
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('cart_items_cart_id_index').on('cart_items').column('cart_id').execute()

  await db.schema.createIndex('cart_items_id_index').on('cart_items').column('id').execute()
}
