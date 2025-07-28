import type { Database } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .alterTable('customers')
    .addColumn('user_id', 'integer', col =>
      col.references('users.id').onDelete('cascade'))
    .execute()
}
