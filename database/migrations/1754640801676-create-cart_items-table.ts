import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('cart_items')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('uuid', 'uuid', (col) => col.defaultTo(sql.raw('gen_random_uuid()')))
    .addColumn('quantity', 'integer', col => col.notNull())
    .addColumn('unit_price', 'integer', col => col.notNull())
    .addColumn('total_price', 'integer', col => col.notNull())
    .addColumn('tax_rate', 'integer')
    .addColumn('tax_amount', 'integer')
    .addColumn('discount_percentage', 'integer')
    .addColumn('discount_amount', 'integer')
    .addColumn('product_name', 'varchar(255)', col => col.notNull())
    .addColumn('product_sku', 'varchar(100)')
    .addColumn('product_image', 'varchar(255)')
    .addColumn('notes', 'varchar(500)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('cart_items_id_index').on('cart_items').column('id').execute()
}
