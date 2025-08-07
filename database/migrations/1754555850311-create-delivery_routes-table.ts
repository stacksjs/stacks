import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('delivery_routes')
    .addColumn('id', 'serial', col => col.primaryKey())
    .addColumn('uuid', 'uuid', col => col.defaultTo(sql.raw('gen_random_uuid()')))
    .addColumn('driver', 'varchar(255)', col => col.notNull())
    .addColumn('vehicle', 'varchar(255)', col => col.notNull())
    .addColumn('stops', 'integer', col => col.notNull())
    .addColumn('delivery_time', 'integer', col => col.notNull())
    .addColumn('total_distance', 'integer', col => col.notNull())
    .addColumn('last_active', 'timestamp', col => col.notNull())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('delivery_routes_id_index').on('delivery_routes').column('id').execute()
}
