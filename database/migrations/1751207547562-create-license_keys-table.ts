import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('license_keys')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('key', 'varchar(255)', col => col.notNull())
    .addColumn('template', sql`enum('Standard License', 'Premium License', 'Enterprise License')`, col => col.notNull())
    .addColumn('expiry_date', 'timestamp', col => col.notNull())
    .addColumn('status', sql`enum('active', 'inactive', 'unassigned')`, col => col.defaultTo('unassigned'))
    .addColumn('customer_id', 'integer', (col) =>
        col.references('customers.id').onDelete('cascade')
      ) 
    .addColumn('product_id', 'integer', (col) =>
        col.references('products.id').onDelete('cascade')
      ) 
    .addColumn('order_id', 'integer', (col) =>
        col.references('orders.id').onDelete('cascade')
      ) 
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('license_keys_customer_id_index').on('license_keys').column('customer_id').execute()

  await db.schema.createIndex('license_keys_product_id_index').on('license_keys').column('product_id').execute()

  await db.schema.createIndex('license_keys_order_id_index').on('license_keys').column('order_id').execute()

  await db.schema.createIndex('license_keys_id_index').on('license_keys').column('id').execute()
}
