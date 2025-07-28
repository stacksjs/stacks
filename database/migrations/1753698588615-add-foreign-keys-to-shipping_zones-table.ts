import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('shipping_zones')
    .addColumn('shipping_method_id', 'integer', col =>
      col.references('shipping_methods.id').onDelete('cascade'))
    .execute()
}
