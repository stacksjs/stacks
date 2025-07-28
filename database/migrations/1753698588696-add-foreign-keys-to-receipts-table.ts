import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('receipts')
    .addColumn('print_device_id', 'integer', col =>
      col.references('print_devices.id').onDelete('cascade'))
    .execute()
}
