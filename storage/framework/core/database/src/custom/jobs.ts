import type { Result } from '@stacksjs/error-handling'
import type { MigrationResult } from '../migrations'
import { log } from '@stacksjs/cli'
import { database } from '@stacksjs/config'
import { err, handleError, ok } from '@stacksjs/error-handling'
import { path } from '@stacksjs/path'
import { hasMigrationBeenCreated } from '../drivers'

export async function createJobsMigration(): Promise<Result<MigrationResult[] | string, Error>> {
  try {
    if (['sqlite', 'mysql'].includes(getDriver())) {
      const hasBeenMigrated = await hasMigrationBeenCreated('jobs')

      if (!hasBeenMigrated) {
        let migrationContent = `import type { Database } from '@stacksjs/database'\nimport { sql } from '@stacksjs/database'\n\n`
        migrationContent += `export async function up(db: Database<any>) {\n`
        migrationContent += `  await db.schema\n`
        migrationContent += `    .createTable('jobs')\n`
        migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
        migrationContent += `    .addColumn('queue', 'varchar(255)', col => col.notNull())\n`
        migrationContent += `    .addColumn('payload', 'text', col => col.notNull())\n`
        migrationContent += `    .addColumn('attempts', 'integer', col => col.notNull().defaultTo(0))\n`
        migrationContent += `    .addColumn('reserved_at', 'timestamp')\n`
        migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n` // When the error was logged
        migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
        migrationContent += `    .execute()\n`
        migrationContent += `}\n`

        const timestamp = new Date().getTime().toString()
        const migrationFileName = `${timestamp}-create-jobs-table.ts`

        const migrationFilePath = path.userMigrationsPath(migrationFileName)

        await Bun.write(migrationFilePath, migrationContent) // Ensure the write operation is awaited

        log.success('Created jobs migration')
      }
      else {
        log.success('Jobs migration already created')
      }
    }

    return ok('Migration created.')
  }
  catch (error) {
    return err(handleError('Error creating migration', error))
  }
}

function getDriver(): string {
  return database.default || ''
}
