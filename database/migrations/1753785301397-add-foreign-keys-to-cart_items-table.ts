import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('cart_items')
    .addColumn('cart_id', 'integer', col =>
      col.references('carts.id').onDelete('cascade'))
    .execute()
  await db.schema.createIndex('cart_items_cart_id_index').on('cart_items').column('cart_id').execute()
}
