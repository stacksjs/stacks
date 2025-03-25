import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('delivery_routes')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('driver', 'text', col => col.notNull())
    .addColumn('vehicle', 'text', col => col.notNull())
    .addColumn('stops', 'numeric', col => col.notNull())
    .addColumn('delivery_time', 'numeric', col => col.notNull())
    .addColumn('total_distance', 'numeric', col => col.notNull())
    .addColumn('last_active', 'text')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
