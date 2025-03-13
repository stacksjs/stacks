import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('coupons')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('code', 'text', col => col.unique().notNull())
    .addColumn('description', 'text')
    .addColumn('discount_type', 'text', col => col.notNull())
    .addColumn('discount_value', 'numeric', col => col.notNull())
    .addColumn('min_order_amount', 'numeric')
    .addColumn('max_discount_amount', 'numeric')
    .addColumn('free_product_id', 'text')
    .addColumn('is_active', 'integer')
    .addColumn('usage_limit', 'numeric')
    .addColumn('usage_count', 'numeric')
    .addColumn('start_date', 'text', col => col.notNull())
    .addColumn('end_date', 'text', col => col.notNull())
    .addColumn('applicable_products', 'text')
    .addColumn('applicable_categories', 'text')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
