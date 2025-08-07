import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('coupons')
    .addColumn('product_id', 'integer', col =>
      col.references('products.id').onDelete('cascade'))
    .execute()
  await db.schema.createIndex('coupons_product_id_index').on('coupons').column('product_id').execute()
}
