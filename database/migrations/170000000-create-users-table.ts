import type { Kysely } from 'kysely'
import { sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('person')
    .addColumn('id', 'integer', col => col.primaryKey())
    .addColumn('first_name', 'text', col => col.notNull())
    .addColumn('last_name', 'text')
    .addColumn('gender', 'text', col => col.notNull())
    .addColumn('created_at', 'text', col =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull())
    .execute()

  await db.schema
    .createTable('pet')
    .addColumn('id', 'integer', col => col.primaryKey())
    .addColumn('name', 'text', col => col.notNull().unique())
    .addColumn('owner_id', 'integer', col =>
      col.references('person.id').onDelete('cascade').notNull())
    .addColumn('species', 'text', col => col.notNull())
    .execute()

  await db.schema
    .createIndex('pet_owner_id_index')
    .on('pet')
    .column('owner_id')
    .execute()
}
