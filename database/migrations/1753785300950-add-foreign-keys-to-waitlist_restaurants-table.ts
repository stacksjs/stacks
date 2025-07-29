import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('waitlist_restaurants')
    .addColumn('customer_id', 'integer', col =>
      col.references('customers.id').onDelete('cascade'))
    .execute()
  await db.schema.createIndex('waitlist_restaurants_customer_id_index').on('waitlist_restaurants').column('customer_id').execute()
}
