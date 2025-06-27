import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('authors')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'varchar(255)')
    .addColumn('name', 'varchar(255)')
    .addColumn('email', 'varchar(255)', col => col.unique())
    .addColumn('user_id', 'integer', col =>
      col.references('users.id').onDelete('cascade'))
    .addColumn('public_passkey', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('authors_email_name_index').on('authors').columns(['email', 'name']).execute()
  await db.schema.createIndex('authors_user_id_index').on('authors').column('user_id').execute()

  await db.schema.createIndex('authors_id_index').on('authors').column('id').execute()
}
