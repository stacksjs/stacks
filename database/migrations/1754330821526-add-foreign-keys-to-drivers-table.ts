import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('drivers')
    .addColumn('user_id', 'integer', (col) =>
      col.references('users.id').onDelete('cascade')
    ) 
    .execute()
  await db.schema.createIndex('drivers_user_id_index').on('drivers').column('user_id').execute()

}
