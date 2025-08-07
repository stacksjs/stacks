import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('receipts')
    .addColumn('print_device_id', 'integer', (col) =>
      col.references('print_devices.id').onDelete('cascade')
    ) 
    .execute()
  await db.schema.createIndex('receipts_print_device_id_index').on('receipts').column('print_device_id').execute()

}
