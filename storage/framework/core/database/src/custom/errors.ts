import { log } from '@stacksjs/cli'
import { database } from '@stacksjs/config'
import { path } from '@stacksjs/path'
import { hasTableBeenMigrated } from '../drivers'

export async function createErrorsTable(): Promise<void> {
  if (['sqlite', 'mysql'].includes(getDriver())) {
    const hasBeenMigrated = await hasTableBeenMigrated('errors')

    if (hasBeenMigrated)
      return

    let migrationContent = `import type { Database } from '@stacksjs/database'\nimport { sql } from '@stacksjs/database'\n\n`
    migrationContent += `export async function up(db: Database<any>) {\n`
    migrationContent += `  await db.schema\n`
    migrationContent += `    .createTable('errors')\n`
    migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
    migrationContent += `    .addColumn('type', 'varchar(255)', col => col.notNull())\n` // The type of error
    migrationContent += `    .addColumn('message', 'text', col => col.notNull())\n` // The error message
    migrationContent += `    .addColumn('stack', 'text')\n` // Optional stack trace
    migrationContent += `    .addColumn('status', 'integer', col => col.notNull().defaultTo(0))\n` // Status code
    migrationContent += `    .addColumn('user_id', 'integer')\n` // Optional user ID if applicable
    migrationContent += `    .addColumn('additional_info', 'text')\n` // Optional field for extra info
    migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n` // When the error was logged
    migrationContent += `    .addColumn('updated_at', 'timestamp')\n` // When the error was last updated
    migrationContent += `    .execute()\n`
    migrationContent += `}\n`

    const timestamp = new Date().getTime().toString()
    const migrationFileName = `${timestamp}-create-errors-table.ts`

    const migrationFilePath = path.userMigrationsPath(migrationFileName)

    await Bun.write(migrationFilePath, migrationContent) // Ensure the write operation is awaited

    log.success('Created errors table')
  }
}

function getDriver(): string {
  return database.default || ''
}
