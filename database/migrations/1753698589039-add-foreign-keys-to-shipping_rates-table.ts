import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('shipping_rates')
    .addColumn('shipping_zone_id', 'integer', col =>
      col.references('shipping_zones.id').onDelete('cascade'))
    .addColumn('shipping_method_id', 'integer', col =>
      col.references('shipping_methods.id').onDelete('cascade'))
    .execute()
}
