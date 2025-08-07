import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('license_keys')
    .addColumn('customer_id', 'integer', (col) =>
      col.references('customers.id').onDelete('cascade')
    ) 
    .addColumn('product_id', 'integer', (col) =>
      col.references('products.id').onDelete('cascade')
    ) 
    .addColumn('order_id', 'integer', (col) =>
      col.references('orders.id').onDelete('cascade')
    ) 
    .execute()
  await db.schema.createIndex('license_keys_customer_id_index').on('license_keys').column('customer_id').execute()

  await db.schema.createIndex('license_keys_product_id_index').on('license_keys').column('product_id').execute()

  await db.schema.createIndex('license_keys_order_id_index').on('license_keys').column('order_id').execute()

}
