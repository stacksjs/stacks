import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('loyalty_rewards')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('name', 'varchar(255)', col => col.notNull())
    .addColumn('description', 'varchar(255)')
    .addColumn('points_required', 'integer', col => col.notNull())
    .addColumn('reward_type', 'varchar(255)', col => col.notNull())
    .addColumn('discount_percentage', 'integer')
    .addColumn('free_product_id', 'varchar(255)')
    .addColumn('is_active', 'boolean')
    .addColumn('expiry_days', 'integer')
    .addColumn('image_url', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('loyalty_rewards_id_index').on('loyalty_rewards').column('id').execute()
}
