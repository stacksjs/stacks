import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('receipts')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('uuid', 'uuid', col => col.defaultTo(sql.raw('gen_random_uuid()')))
    .addColumn('printer', 'varchar(100)')
    .addColumn('document', 'varchar(100)', col => col.notNull())
    .addColumn('timestamp', 'timestamp', col => col.notNull())
    .addColumn('status', 'varchar(255)', col => col.notNull())
    .addColumn('size', 'integer')
    .addColumn('pages', 'integer')
    .addColumn('duration', 'integer')
    .addColumn('metadata', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('receipts_id_index').on('receipts').column('id').execute()
}
