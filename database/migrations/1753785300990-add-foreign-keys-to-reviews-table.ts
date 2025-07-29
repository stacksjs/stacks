import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('reviews')
    .addColumn('customer_id', 'integer', col =>
      col.references('customers.id').onDelete('cascade'))
    .addColumn('product_id', 'integer', col =>
      col.references('products.id').onDelete('cascade'))
    .execute()
  await db.schema.createIndex('reviews_customer_id_index').on('reviews').column('customer_id').execute()

  await db.schema.createIndex('reviews_product_id_index').on('reviews').column('product_id').execute()
}
