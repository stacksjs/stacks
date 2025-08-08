import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('product_variants')
    .addColumn('product_id', 'integer', col =>
      col.references('products.id').onDelete('cascade'))
    .execute()
  await db.schema.createIndex('product_variants_product_id_index').on('product_variants').column('product_id').execute()
}
