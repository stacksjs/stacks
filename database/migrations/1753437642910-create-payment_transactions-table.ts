import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('payment_transactions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql.raw('gen_random_uuid()')))
    .addColumn('name', 'varchar(255)')
    .addColumn('description', 'varchar(255)')
    .addColumn('amount', 'integer')
    .addColumn('type', 'varchar(50)')
    .addColumn('provider_id', 'varchar(255)')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))
    .addColumn('updated_at', 'timestamp')
    .execute()
  await db.schema.createIndex('payment_transactions_id_index').on('payment_transactions').column('id').execute()
}
