import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('reviews')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('rating', 'integer', col => col.notNull())
    .addColumn('title', 'varchar(100)', col => col.notNull())
    .addColumn('content', 'varchar(2000)', col => col.notNull())
    .addColumn('is_verified_purchase', 'boolean')
    .addColumn('is_approved', 'boolean')
    .addColumn('is_featured', 'boolean')
    .addColumn('helpful_votes', 'integer', col => col.defaultTo(0))
    .addColumn('unhelpful_votes', 'integer', col => col.defaultTo(0))
    .addColumn('purchase_date', 'varchar(255)')
    .addColumn('images', 'varchar(255)')
    .addColumn('customer_id', 'integer', col =>
      col.references('customers.id').onDelete('cascade'))
    .addColumn('product_id', 'integer', col =>
      col.references('products.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('reviews_customer_id_index').on('reviews').column('customer_id').execute()

  await db.schema.createIndex('reviews_product_id_index').on('reviews').column('product_id').execute()

  await db.schema.createIndex('reviews_id_index').on('reviews').column('id').execute()
}
