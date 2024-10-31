import { $ } from 'bun'
import { log } from '@stacksjs/cli'
import { database } from '@stacksjs/config'
import { type Err, err, handleError, type Ok, ok, type Result } from '@stacksjs/error-handling'
import { path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'
import { FileMigrationProvider, type MigrationResult, Migrator } from 'kysely'
import { generateMysqlMigration, generatePostgresMigration, generateSqliteMigration, hasTableBeenMigrated, resetMysqlDatabase, resetPostgresDatabase, resetSqliteDatabase } from './drivers'
import { db } from './utils'

const driver = database.default || ''

export const migrator: Migrator = new Migrator({
  db,

  provider: new FileMigrationProvider({
    fs,
    path,
    // This needs to be an absolute path.
    migrationFolder: path.userMigrationsPath(),
  }),

  migrationTableName: database.migrations,
  migrationLockTableName: database.migrationLocks,
})

// const migratorForeign = new Migrator({
//   db,

//   provider: new FileMigrationProvider({
//     fs,
//     path,
//     // This needs to be an absolute path.
//     migrationFolder: path.userMigrationsPath('foreign'),
//   }),
// })

export async function runDatabaseMigration(): Promise<Result<MigrationResult[] | string, Error>> {
  try {
    log.info('Migrating database...')

    const { error, results } = await migrator.migrateToLatest()

    if (error) {
      return err(handleError(error))
    }

    if (results?.length === 0) {
      log.success('No new migrations were executed')
      return ok('No new migrations were executed')
    }

    if (results)
      return ok(results)

    log.success('Database migration completed with no new migrations.')
    return ok('Database migration completed with no new migrations.')
  }
  catch (error) {
    return err(handleError('Migration failed', error))
  }
}

export interface MigrationOptions {
  name: string
  up: string
}

export async function resetDatabase(): Promise<Ok<string, never>> {
  if (driver === 'sqlite')
    return await resetSqliteDatabase()
  if (driver === 'mysql')
    return await resetMysqlDatabase()
  if (driver === 'postgres')
    return await resetPostgresDatabase()

  throw new Error('Unsupported database driver in resetDatabase')
}

export async function generateMigrations(): Promise<Ok<string, never> | Err<string, any>> {
  try {
    log.info('Generating migrations...')

    const modelFiles = globSync([path.userModelsPath('*.ts')], { absolute: true })

    for (const file of modelFiles) {
      log.debug('Generating migration for:', file)

      await generateMigration(file)
    }

    await createErrorsTable()

    log.success('Migrations generated')
    return ok('Migrations generated')
  }
  catch (error) {
    return err(error)
  }
}

async function createErrorsTable(): Promise<void> {
  if (['sqlite', 'mysql'].includes(driver)) {
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
    migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n` // When the error was logged
    migrationContent += `    .addColumn('updated_at', 'timestamp')\n` // When the error was last updated
    migrationContent += `    .addColumn('user_id', 'integer')\n` // Optional user ID if applicable
    migrationContent += `    .addColumn('additional_info', 'text')\n` // Optional field for extra info
    migrationContent += `    .execute()\n`
    migrationContent += `}\n`

    const timestamp = new Date().getTime().toString()
    const migrationFileName = `${timestamp}-create-errors-table.ts`

    const migrationFilePath = path.userMigrationsPath(migrationFileName)

    await Bun.write(migrationFilePath, migrationContent) // Ensure the write operation is awaited

    log.success('Created errors table')
  }
}

export async function generateMigration(modelPath: string): Promise<void> {
  if (driver === 'sqlite')
    await generateSqliteMigration(modelPath)

  if (driver === 'mysql')
    await generateMysqlMigration(modelPath)

  if (driver === 'postgres')
    await generatePostgresMigration(modelPath)
}

export async function haveModelFieldsChangedSinceLastMigration(modelPath: string): Promise<boolean> {
  log.debug(`haveModelFieldsChangedSinceLastMigration for model: ${modelPath}`)

  // const model = await import(modelPath)
  // const tableName = model.default.table
  // const lastMigration = await lastMigrationDate()

  // now that we know the date, we need to check the git history for changes to the model file since that date
  const cmd = ``
  const gitHistory = await $`${cmd}`.text()

  // if there are updates, then we need to check whether
  // the updates include the any updates to the model
  // fields that would require a migration

  return !!gitHistory
}

export async function lastMigration(): Promise<any> {
  try {
    return await db.selectFrom('migrations').selectAll().orderBy('timestamp', 'desc').limit(1).execute()
  }
  catch (error) {
    console.error('Failed to get last migration:', error)
    return { error }
  }
}

export async function lastMigrationDate(): Promise<string | undefined> {
  try {
    return (await db.selectFrom('migrations').select('timestamp').orderBy('timestamp', 'desc').limit(1).execute())[0]
      .timestamp
  }
  catch (error) {
    console.error('Failed to get last migration date:', error)
    return undefined
  }
}

export type { MigrationResult }
