import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('subscribers')
    .addColumn('user_id', 'integer', (col) =>
      col.references('users.id').onDelete('cascade')
    ) 
    .execute()
  await db.schema.createIndex('subscribers_user_id_index').on('subscribers').column('user_id').execute()

}
