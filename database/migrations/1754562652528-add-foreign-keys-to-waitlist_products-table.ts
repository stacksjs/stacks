import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('waitlist_products')
    .addColumn('customer_id', 'integer', (col) =>
      col.references('customers.id').onDelete('cascade')
    ) 
    .addColumn('product_id', 'integer', (col) =>
      col.references('products.id').onDelete('cascade')
    ) 
    .execute()
  await db.schema.createIndex('waitlist_products_customer_id_index').on('waitlist_products').column('customer_id').execute()

  await db.schema.createIndex('waitlist_products_product_id_index').on('waitlist_products').column('product_id').execute()

}
