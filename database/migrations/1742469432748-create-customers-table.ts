import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('customers')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('email', 'text', col => col.unique().notNull())
    .addColumn('phone', 'text', col => col.notNull())
    .addColumn('total_spent', 'numeric', col => col.defaultTo(0))
    .addColumn('last_order', 'text')
    .addColumn('status', 'text', col => col.notNull().defaultTo('Active'))
    .addColumn('avatar', 'text')
    .addColumn('user_id', 'integer', (col) =>
        col.references('users.id').onDelete('cascade')
      ) 
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
