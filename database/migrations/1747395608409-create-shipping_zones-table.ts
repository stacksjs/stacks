import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('shipping_zones')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('name', 'varchar(255)', col => col.notNull())
    .addColumn('countries', 'varchar(255)')
    .addColumn('regions', 'varchar(255)')
    .addColumn('postal_codes', 'varchar(255)')
    .addColumn('status', sql`enum('active', 'inactive', 'draft')`, col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('shipping_zones_id_index').on('shipping_zones').column('id').execute()
}
