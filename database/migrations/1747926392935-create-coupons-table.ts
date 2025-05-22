import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('coupons')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('code', 'varchar(50)', col => col.unique().notNull())
    .addColumn('description', 'varchar(255)')
    .addColumn('discount_type', 'varchar(255)', col => col.notNull())
    .addColumn('discount_value', 'integer', col => col.notNull())
    .addColumn('min_order_amount', 'integer')
    .addColumn('max_discount_amount', 'integer')
    .addColumn('free_product_id', 'varchar(255)')
    .addColumn('is_active', 'boolean')
    .addColumn('usage_limit', 'integer')
    .addColumn('usage_count', 'integer')
    .addColumn('start_date', 'date', col => col.notNull())
    .addColumn('end_date', 'date', col => col.notNull())
    .addColumn('applicable_products', 'varchar(255)')
    .addColumn('applicable_categories', 'varchar(255)')
    .addColumn('product_id', 'integer', (col) =>
        col.references('products.id').onDelete('cascade')
      ) 
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('coupons_product_id_index').on('coupons').column('product_id').execute()

  await db.schema.createIndex('coupons_id_index').on('coupons').column('id').execute()
}
