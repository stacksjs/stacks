import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('coupons')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('code', 'text', col => col.notNull().unique())
    .addColumn('description', 'text')
    .addColumn('status', 'text')
    .addColumn('is_active', 'boolean', col => col.notNull())
    .addColumn('discount_type', 'text', col => col.notNull())
    .addColumn('discount_value', 'integer', col => col.notNull())
    .addColumn('min_order_amount', 'integer')
    .addColumn('max_discount_amount', 'integer')
    .addColumn('free_product_id', 'text')
    .addColumn('usage_limit', 'integer')
    .addColumn('usage_count', 'integer')
    .addColumn('start_date', 'date')
    .addColumn('end_date', 'date')
    .addColumn('product_id', 'integer', (col) =>
        col.references('products.id').onDelete('cascade')
      ) 
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('coupons_product_id_index').on('coupons').column(`product_id`).execute()

  await db.schema.createIndex('coupons_id_index').on('coupons').column('id').execute()
}
