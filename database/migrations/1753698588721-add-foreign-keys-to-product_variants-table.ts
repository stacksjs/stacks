import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('product_variants')
    .addColumn('product_id', 'integer', col =>
      col.references('products.id').onDelete('cascade'))
    .execute()
}
