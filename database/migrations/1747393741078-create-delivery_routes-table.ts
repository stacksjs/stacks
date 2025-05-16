import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('delivery_routes')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('driver', 'varchar(255)', col => col.notNull())
    .addColumn('vehicle', 'varchar(255)', col => col.notNull())
    .addColumn('stops', 'double', col => col.notNull())
    .addColumn('delivery_time', 'double', col => col.notNull())
    .addColumn('total_distance', 'double', col => col.notNull())
    .addColumn('last_active', 'date')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('delivery_routes_id_index').on('delivery_routes').column('id').execute()
}
