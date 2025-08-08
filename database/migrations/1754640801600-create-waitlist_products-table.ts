import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('waitlist_products')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('uuid', 'uuid', col => col.defaultTo(sql.raw('gen_random_uuid()')))
    .addColumn('name', 'varchar(255)', col => col.notNull())
    .addColumn('email', 'varchar(255)', col => col.notNull())
    .addColumn('phone', 'varchar(100)')
    .addColumn('quantity', 'integer', col => col.notNull())
    .addColumn('notification_preference', 'varchar(255)', col => col.notNull())
    .addColumn('source', 'varchar(100)', col => col.notNull())
    .addColumn('notes', 'varchar(255)')
    .addColumn('status', 'varchar(255)', col => col.notNull().defaultTo('waiting'))
    .addColumn('notified_at', 'bigint')
    .addColumn('purchased_at', 'bigint')
    .addColumn('cancelled_at', 'bigint')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('waitlist_products_id_index').on('waitlist_products').column('id').execute()
}
