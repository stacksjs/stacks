import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('product_units')
    .addColumn('product_id', 'integer', (col) =>
      col.references('products.id').onDelete('cascade')
    ) 
    .execute()
  await db.schema.createIndex('product_units_product_id_index').on('product_units').column('product_id').execute()

}
