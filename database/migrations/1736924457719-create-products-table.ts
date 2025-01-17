import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('products')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('name', 'varchar(512)', col => col.notNull())
    .addColumn('description', 'integer')
    .addColumn('key', 'integer', col => col.notNull())
    .addColumn('unit_price', 'integer')
    .addColumn('status', 'varchar(255)')
    .addColumn('image', 'varchar(255)')
    .addColumn('provider_id', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
