import type { Err, Ok, Result } from '@stacksjs/error-handling'
import type { MigrationResult } from 'kysely'
import { log } from '@stacksjs/cli'
import { database } from '@stacksjs/config'
import { err, handleError, ok } from '@stacksjs/error-handling'
import { path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'
import { FileMigrationProvider, Migrator } from 'kysely'
import { createMysqlForeignKeyMigrations, createPostgresForeignKeyMigrations, createSqliteForeignKeyMigrations, generateMysqlMigration, generateMysqlTraitMigrations, generatePostgresMigration, generatePostgresTraitMigrations, generateSqliteMigration, resetMysqlDatabase, resetPostgresDatabase, resetSqliteDatabase } from './drivers'

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
      console.error('Migration error:', error)
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
      await generatePostgresTraitMigrations()
    }
    else {
      await generateMysqlTraitMigrations()
    }

    const modelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/models/**/*.ts')], { absolute: true })

    for (const file of modelFiles) {
      log.debug('Generating migration for:', file)

      await generateMigration(file)
    }

    for (const file of modelFiles) {
      await generateForeignKeyMigration(file)
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

export async function generateForeignKeyMigration(modelPath: string): Promise<void> {
  if (getDriver() === 'sqlite')
    await createSqliteForeignKeyMigrations(modelPath)

  if (getDriver() === 'mysql')
    await createMysqlForeignKeyMigrations(modelPath)

  if (getDriver() === 'postgres')
    await createPostgresForeignKeyMigrations(modelPath)
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
