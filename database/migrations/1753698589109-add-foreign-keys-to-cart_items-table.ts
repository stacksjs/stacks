import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('cart_items')
    .addColumn('cart_id', 'integer', col =>
      col.references('carts.id').onDelete('cascade'))
    .execute()
}
