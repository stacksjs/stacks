import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema.alterTable('users')
    .addColumn('content', 'varchar(255)', col => col.notNull())
    .execute();
}
