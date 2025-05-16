import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('receipts')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('printer', 'varchar(255)', col => col.notNull())
    .addColumn('document', 'varchar(255)', col => col.notNull())
    .addColumn('timestamp', 'integer', col => col.notNull())
    .addColumn('status', sql`enum('success', 'failed', 'warning')`, col => col.notNull())
    .addColumn('size', 'integer')
    .addColumn('pages', 'integer')
    .addColumn('duration', 'integer')
    .addColumn('metadata', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('receipts_id_index').on('receipts').column('id').execute()
}
