import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('loyalty_rewards')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('description', 'text')
    .addColumn('points_required', 'integer', col => col.notNull())
    .addColumn('reward_type', 'text', col => col.notNull())
    .addColumn('discount_percentage', 'integer')
    .addColumn('free_product_id', 'text')
    .addColumn('is_active', 'boolean')
    .addColumn('expiry_days', 'integer')
    .addColumn('image_url', 'text')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('loyalty_rewards_id_index').on('loyalty_rewards').column('id').execute()
}
