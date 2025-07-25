import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('drivers')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql.raw('gen_random_uuid()')))
    .addColumn('name', 'varchar(255)', col => col.notNull())
    .addColumn('phone', 'varchar(255)', col => col.notNull())
    .addColumn('vehicle_number', 'varchar(255)', col => col.notNull())
    .addColumn('license', 'varchar(255)', col => col.notNull())
    .addColumn('status', 'varchar(255)', col => col.defaultTo('active'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('drivers_id_index').on('drivers').column('id').execute()
}
