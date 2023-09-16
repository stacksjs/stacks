import { Kysely, sql } from 'kysely'
import { db } from '@stacksjs/database'
 
export async function up(db: Kysely<any>): Promise<void> { 
  await db.schema 
  .createTable('users') 
 .addColumn('name', 'varchar(50)', (col) => col.notNull()) 
 .addColumn('status', 'varchar(50)', (col) => col.notNull()) 
 .addColumn('email', 'varchar(50)', (col) => col.notNull()) 
 .addColumn('password', 'varchar(50)', (col) => col.notNull()) 
 .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull()) 
 .execute() 
} 

process.exit(0) 
