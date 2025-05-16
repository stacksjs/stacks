import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  await db.schema
    .createTable('users')
    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
    .addColumn('uuid', 'text')
    .addColumn('email', 'text', col => col.unique().notNull())
    .addColumn('name', 'text', col => col.notNull())
    .addColumn('password', 'text', col => col.notNull())
    .addColumn('job_title', 'text', col => col.notNull())
    .addColumn('team_id', 'integer', (col) =>
        col.references('teams.id').onDelete('cascade')
      ) 
    .addColumn('public_passkey', 'text')
    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamp')
    .execute()

  await db.schema.createIndex('users_team_id_index').on('users').column('team_id').execute()


  await db.schema.createIndex('users_email_name_index').on('users').columns(['email', 'name']).execute()
  await db.schema.createIndex('users_job_title_status_index').on('users').columns(['job_title', 'created_at']).execute()
  await db.schema.createIndex('users_id_index').on('users').column('id').execute()
}
