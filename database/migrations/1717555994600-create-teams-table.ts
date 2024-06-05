import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('teams')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('name', 'varchar(255)')
    .addColumn('companyName', 'varchar(255)')
    .addColumn('email', 'varchar(255)')
    .addColumn('billingEmail', 'varchar(255)')
    .addColumn('status', 'varchar(255)')
    .addColumn('description', 'varchar(255)')
    .addColumn('path', 'varchar(255)')
    .addColumn('isPersonal', 'boolean')
    .addColumn('accesstoken_id', 'integer', (col) =>
        col.references('access_tokens.id').onDelete('cascade')
      ) 
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
}
