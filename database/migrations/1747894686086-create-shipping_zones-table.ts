import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('shipping_zones')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('name', 'varchar(100)', col => col.notNull())
    .addColumn('countries', 'varchar(1000)')
    .addColumn('regions', 'varchar(500)')
    .addColumn('postal_codes', 'varchar(1000)')
    .addColumn('status', sql`enum('active', 'inactive', 'draft')`, col => col.notNull())
    .addColumn('shipping_method_id', 'integer', col =>
      col.references('shipping_methods.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('shipping_zones_shipping_method_id_index').on('shipping_zones').column('shipping_method_id').execute()

  await db.schema.createIndex('shipping_zones_id_index').on('shipping_zones').column('id').execute()
}
