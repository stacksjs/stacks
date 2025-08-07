import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('delivery_routes')
    .addColumn('driver_id', 'integer', (col) =>
      col.references('drivers.id').onDelete('cascade')
    ) 
    .execute()
  await db.schema.createIndex('delivery_routes_driver_id_index').on('delivery_routes').column('driver_id').execute()

}
