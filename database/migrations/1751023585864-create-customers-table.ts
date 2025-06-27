import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('customers')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('name', 'varchar(255)', col => col.notNull())
    .addColumn('email', 'varchar(255)', col => col.notNull().unique())
    .addColumn('phone', 'varchar(50)', col => col.notNull())
    .addColumn('total_spent', 'integer', col => col.defaultTo(0))
    .addColumn('last_order', 'varchar(255)')
    .addColumn('status', sql`enum('Active', 'Inactive')`, col => col.notNull().defaultTo('Active'))
    .addColumn('avatar', 'varchar(255)', col => col.notNull())
    .addColumn('user_id', 'integer', col =>
      col.references('users.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('customers_user_id_index').on('customers').column('user_id').execute()

  await db.schema.createIndex('customers_id_index').on('customers').column('id').execute()
}
