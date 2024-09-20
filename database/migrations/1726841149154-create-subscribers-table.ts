import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('subscribers')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('subscribed', 'boolean')
    .addColumn('created_at', 'text', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'text', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()
}
