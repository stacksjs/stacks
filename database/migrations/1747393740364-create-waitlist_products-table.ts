import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('waitlist_products')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('name', 'varchar(255)', col => col.notNull())
    .addColumn('email', 'varchar(255)', col => col.notNull())
    .addColumn('phone', 'varchar(100)')
    .addColumn('quantity', 'double', col => col.notNull())
    .addColumn('notification_preference', sql`enum('sms', 'email', 'both')`, col => col.notNull())
    .addColumn('source', 'varchar(100)', col => col.notNull())
    .addColumn('notes', 'varchar(255)')
    .addColumn('status', sql`enum('waiting', 'purchased', 'notified', 'cancelled')`, col => col.notNull().defaultTo('waiting'))
    .addColumn('notified_at', 'double')
    .addColumn('purchased_at', 'double')
    .addColumn('cancelled_at', 'double')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('waitlist_products_id_index').on('waitlist_products').column('id').execute()
}
