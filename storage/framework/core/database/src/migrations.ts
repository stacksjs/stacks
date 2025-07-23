import type { Err, Ok, Result } from '@stacksjs/error-handling'
import type { MigrationResult } from 'kysely'
import { log } from '@stacksjs/cli'
import { database } from '@stacksjs/config'
import { err, handleError, ok } from '@stacksjs/error-handling'
import { path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'
import { FileMigrationProvider, Migrator } from 'kysely'
import { generateMysqlMigration, generatePostgresMigration, generateSqliteMigration, resetMysqlDatabase, resetPostgresDatabase, resetSqliteDatabase } from './drivers'
import { createPasswordResetsTable } from './drivers/defaults/passwords'
import {
  createCategorizableModelsTable,
  createCategorizableTable,
  createCommentablesTable,
  createCommentUpvoteMigration,
  createPasskeyMigration,
  createPostgresCategorizableTable,
  createPostgresCommenteableTable,
  createPostgresCommentUpvoteMigration,
  createPostgresPasskeyMigration,
  createPostgresQueryLogsTable,
  createPostgresTaggableTable,
  createQueryLogsTable,
  createTaggableTable,
} from './drivers/defaults/traits'
import { db } from './utils'

function getDriver(): string {
  return database.default || ''
}

export function migrator(): Migrator {
  return new Migrator({
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
}

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

    const { error, results } = await migrator().migrateToLatest()

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
  if (getDriver() === 'sqlite')
    return await resetSqliteDatabase()
  if (getDriver() === 'mysql')
    return await resetMysqlDatabase()
  if (getDriver() === 'postgres')
    return await resetPostgresDatabase()

  throw new Error('Unsupported database driver in resetDatabase')
}

export async function generateMigrations(): Promise<Ok<string, never> | Err<string, any>> {
  try {
    log.info('Generating migrations...')

  
    // Create framework tables first
    if (getDriver() === 'postgres') {
      // PostgreSQL has its own specific table creation functions
      // await createPostgresCategorizableTable()
      // await createPostgresCommenteableTable()
      // await createPostgresTaggableTable()
      // await createPostgresCommentUpvoteMigration()
      // await createPostgresPasskeyMigration()
      // await createCategorizableModelsTable()
      // await createPostgresQueryLogsTable()
      // await createPasswordResetsTable()
    }
    else {
      // SQLite and MySQL use the same table creation functions
      await createCategorizableTable()
      await createCommentablesTable()
      await createTaggableTable()
      await createPasswordResetsTable()
      await createPasskeyMigration()
      await createQueryLogsTable()
      await createCommentUpvoteMigration()
    }

    const modelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/models/**/*.ts')], { absolute: true })

    for (const file of modelFiles) {
      log.debug('Generating migration for:', file)

      await generateMigration(file)
    }

    log.success('Migrations generated')
    return ok('Migrations generated')
  }
  catch (error) {
    return err(error)
  }
}

export async function generateMigration(modelPath: string): Promise<void> {
  if (getDriver() === 'sqlite')
    await generateSqliteMigration(modelPath)

  if (getDriver() === 'mysql')
    await generateMysqlMigration(modelPath)

  if (getDriver() === 'postgres')
    await generatePostgresMigration(modelPath)
}

export async function haveModelFieldsChangedSinceLastMigration(modelPath: string): Promise<boolean> {
  log.debug(`haveModelFieldsChangedSinceLastMigration for model: ${modelPath}`)

  // const model = await import(modelPath)
  // const tableName = model.default.table
  // const lastMigration = await lastMigrationDate()

  // now that we know the date, we need to check the git history for changes to the model file since that date
  const cmd = ``
  const gitHistory = await Bun.$`${cmd}`.text()

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
