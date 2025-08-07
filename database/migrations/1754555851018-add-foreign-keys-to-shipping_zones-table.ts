import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('shipping_zones')
    .addColumn('shipping_method_id', 'integer', (col) =>
      col.references('shipping_methods.id').onDelete('cascade')
    ) 
    .execute()
  await db.schema.createIndex('shipping_zones_shipping_method_id_index').on('shipping_zones').column('shipping_method_id').execute()

}
