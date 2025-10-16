import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('drivers')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('phone', 'text', col => col.notNull())
    .addColumn('vehicle_number', 'text', col => col.notNull())
    .addColumn('license', 'text', col => col.notNull())
    .addColumn('status', 'text', col => col.defaultTo('active'))
    .addColumn('user_id', 'integer', (col) =>
        col.references('users.id').onDelete('cascade')
      ) 
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('drivers_user_id_index').on('drivers').column(`user_id`).execute()

  await db.schema.createIndex('drivers_id_index').on('drivers').column('id').execute()
}
