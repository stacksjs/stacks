import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('subscriber_emails')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('email', 'varchar(255)', col => col.notNull().unique())
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .addColumn('deleted_at', 'timestamp')
    .execute()
  await db.schema.createIndex('subscriber_emails_id_index').on('subscriber_emails').column('id').execute()
}
