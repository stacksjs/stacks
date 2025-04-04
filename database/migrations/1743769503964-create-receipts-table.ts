import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('receipts')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('printer', 'text', col => col.notNull())
    .addColumn('document', 'text', col => col.notNull())
    .addColumn('timestamp', 'numeric', col => col.notNull())
    .addColumn('status', 'text', col => col.notNull())
    .addColumn('size', 'numeric')
    .addColumn('pages', 'numeric')
    .addColumn('duration', 'numeric')
    .addColumn('print_device_id', 'integer', col =>
      col.references('print_devices.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('receipts_print_device_id_index').on('receipts').column('print_device_id').execute()

  await db.schema.createIndex('receipts_id_index').on('receipts').column('id').execute()
}
