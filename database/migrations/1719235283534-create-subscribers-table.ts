import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('subscribers')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('subscribed', 'boolean')
    .addColumn('user_id', 'integer', (col) =>
        col.references('users.id').onDelete('cascade')
      ) 
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
