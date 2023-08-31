import { Kysely, sql } from 'kysely'
import { db } from '@stacksjs/database'
 
export async function up(db: Kysely<any>): Promise<void> { 
  await db.schema 
  .createTable('users') 
.addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull()) 
