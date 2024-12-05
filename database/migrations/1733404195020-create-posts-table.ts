import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('posts')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('title', 'varchar(255)')
    .addColumn('body', 'varchar(255)')
    .addColumn('user_id', 'integer', (col) =>
        col.references('undefined.id').onDelete('cascade')
      ) 
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
