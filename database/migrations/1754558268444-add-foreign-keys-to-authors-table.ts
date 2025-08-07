import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('authors')
    .addColumn('user_id', 'integer', (col) =>
      col.references('users.id').onDelete('cascade')
    ) 
    .execute()

  await db.schema.createIndex('authors_email_name_index').on('authors').columns(['email', 'name']).execute()
  await db.schema.createIndex('authors_user_id_index').on('authors').column('user_id').execute()

}
