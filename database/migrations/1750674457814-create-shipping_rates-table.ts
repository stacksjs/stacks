import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('shipping_rates')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('weight_from', 'integer', col => col.notNull())
    .addColumn('weight_to', 'integer', col => col.notNull())
    .addColumn('rate', 'integer', col => col.notNull())
    .addColumn('shipping_zone_id', 'integer', col =>
      col.references('shipping_zones.id').onDelete('cascade'))
    .addColumn('shipping_method_id', 'integer', col =>
      col.references('shipping_methods.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('shipping_rates_shipping_zone_id_index').on('shipping_rates').column('shipping_zone_id').execute()

  await db.schema.createIndex('shipping_rates_shipping_method_id_index').on('shipping_rates').column('shipping_method_id').execute()

  await db.schema.createIndex('shipping_rates_id_index').on('shipping_rates').column('id').execute()
}
