import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('product_variants')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('variant', 'text', col => col.notNull())
    .addColumn('type', 'text', col => col.notNull())
    .addColumn('description', 'text')
    .addColumn('options', 'text')
    .addColumn('status', 'text', col => col.notNull())
    .addColumn('product_id', 'integer', (col) =>
        col.references('products.id').onDelete('cascade')
      ) 
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('product_variants_product_id_index').on('product_variants').column(`product_id`).execute()

  await db.schema.createIndex('product_variants_id_index').on('product_variants').column('id').execute()
}
