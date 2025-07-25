import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('loyalty_points')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql.raw('gen_random_uuid()')))
    .addColumn('wallet_id', 'varchar(255)', col => col.notNull())
    .addColumn('points', 'integer', col => col.notNull())
    .addColumn('source', 'varchar(255)')
    .addColumn('source_reference_id', 'varchar(255)')
    .addColumn('description', 'varchar(255)')
    .addColumn('expiry_date', 'timestamp')
    .addColumn('is_used', 'boolean')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('loyalty_points_id_index').on('loyalty_points').column('id').execute()
}
