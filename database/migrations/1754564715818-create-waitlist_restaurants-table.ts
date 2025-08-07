import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('waitlist_restaurants')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('uuid', 'uuid', col => col.defaultTo(sql.raw('gen_random_uuid()')))
    .addColumn('name', 'varchar(255)', col => col.notNull())
    .addColumn('email', 'varchar(255)', col => col.notNull())
    .addColumn('phone', 'varchar(100)')
    .addColumn('party_size', 'integer', col => col.notNull())
    .addColumn('check_in_time', 'timestamp', col => col.notNull())
    .addColumn('table_preference', 'varchar(255)', col => col.notNull())
    .addColumn('status', 'varchar(255)', col => col.notNull().defaultTo('waiting'))
    .addColumn('quoted_wait_time', 'integer', col => col.notNull())
    .addColumn('actual_wait_time', 'integer')
    .addColumn('queue_position', 'integer')
    .addColumn('seated_at', 'timestamp')
    .addColumn('no_show_at', 'timestamp')
    .addColumn('cancelled_at', 'timestamp')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('waitlist_restaurants_id_index').on('waitlist_restaurants').column('id').execute()
}
