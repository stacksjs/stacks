import { italic, log } from '@stacksjs/cli'
import { path } from '@stacksjs/path'
import { hasMigrationBeenCreated } from '../index'

// SQLite/MySQL version
export async function createPasswordResetsTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('password_resets')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('password_resets')\n`
  migrationContent += `    .addColumn('email', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('token', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('password_resets_email_index')\n`
  migrationContent += `    .on('password_resets')\n`
  migrationContent += `    .column('email')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('password_resets_token_index')\n`
  migrationContent += `    .on('password_resets')\n`
  migrationContent += `    .column('token')\n`
  migrationContent += `    .execute()\n`
  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-password-resets-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

// PostgreSQL version
export async function createPostgresPasswordResetsTable(): Promise<void> {
  const hasBeenMigrated = await hasMigrationBeenCreated('password_resets')

  if (hasBeenMigrated)
    return

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('password_resets')\n`
  migrationContent += `    .addColumn('email', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('token', 'varchar(255)', col => col.notNull())\n`
  migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('password_resets_email_index')\n`
  migrationContent += `    .on('password_resets')\n`
  migrationContent += `    .column('email')\n`
  migrationContent += `    .execute()\n\n`

  migrationContent += `  await db.schema\n`
  migrationContent += `    .createIndex('password_resets_token_index')\n`
  migrationContent += `    .on('password_resets')\n`
  migrationContent += `    .column('token')\n`
  migrationContent += `    .execute()\n`
  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-password-resets-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}
