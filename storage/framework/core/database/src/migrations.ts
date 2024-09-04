import { dim, italic, log } from '@stacksjs/cli'
import { database } from '@stacksjs/config'
import { err, ok } from '@stacksjs/error-handling'
import { extractAttributesFromModel } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { fs, glob } from '@stacksjs/storage'
import type { Attribute, Attributes } from '@stacksjs/types'
import { $ } from 'bun'
import { FileMigrationProvider, Migrator } from 'kysely'
import { generateMysqlMigration, resetMysqlDatabase } from './drivers'
import { generatePostgresMigration, resetPostgresDatabase } from './drivers'
import { generateSqliteMigration, resetSqliteDatabase } from './drivers'
import { db } from './utils'

const driver = database.default || ''

export const migrator = new Migrator({
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

export async function runDatabaseMigration() {
  try {
    log.info('Migrating database...')

    const { error, results } = await migrator.migrateToLatest()

    if (error) {
      log.error(error)
      return err(error)
    }

    if (results?.length === 0) {
      log.success('No new migrations were executed')
      return ok('No new migrations were executed')
    }

    if (results) return ok(results)

    log.success('Database migration completed with no new migrations.')
    return ok('Database migration completed with no new migrations.')
  } catch (error) {
    console.error('Migration failed:', error)
    return err(error)
  }
}

export interface MigrationOptions {
  name: string
  up: string
}

export async function resetDatabase() {
  if (driver === 'sqlite') return resetSqliteDatabase()

  if (driver === 'mysql') return resetMysqlDatabase()

  if (driver === 'postgres') return resetPostgresDatabase()

  throw new Error('Unsupported database driver in resetDatabase')
}

export async function generateMigrations() {
  try {
    log.info('Generating migrations...')

    const modelFiles = glob.sync(path.userModelsPath('*.ts'))

    for (const file of modelFiles) {
      log.debug('Generating migration for:', file)

      await generateMigration(file)
    }

    log.success('Migrations generated')
    return ok('Migrations generated')
  } catch (error) {
    return err(error)
  }
}

export async function generateMigration(modelPath: string) {
  if (driver === 'sqlite') await generateSqliteMigration(modelPath)

  if (driver === 'mysql') await generateMysqlMigration(modelPath)

  if (driver === 'postgres') await generatePostgresMigration(modelPath)
}

export async function getExecutedMigrations() {
  try {
    // @ts-expect-error the migrations table is not typed yet
    return await db.selectFrom('migrations').select('name').execute()
  } catch (error) {
    return []
  }
}

export async function haveModelFieldsChangedSinceLastMigration(modelPath: string) {
  log.debug(`haveModelFieldsChangedSinceLastMigration for model: ${modelPath}`)

  // const model = await import(/* @vite-ignore */ modelPath)
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

export async function lastMigration() {
  try {
    // @ts-expect-error the migrations table is not typed yet
    return await db.selectFrom('migrations').selectAll().orderBy('timestamp', 'desc').limit(1).execute()
  } catch (error) {
    console.error('Failed to get last migration:', error)
    return { error }
  }
}

export async function lastMigrationDate(): Promise<string | undefined> {
  try {
    // @ts-expect-error the migrations table is not typed yet
    return (await db.selectFrom('migrations').select('timestamp').orderBy('timestamp', 'desc').limit(1).execute())[0]
      .timestamp
  } catch (error) {
    console.error('Failed to get last migration date:', error)
    return undefined
  }
}

// This is a placeholder function. You need to implement the logic to
// read the last migration file and extract the fields that were modified.
export async function getLastMigrationFields(modelName: string): Promise<Attribute> {
  const oldModelPath = path.frameworkPath(`database/models/${modelName}`)
  const model = (await import(oldModelPath)).default as Model
  let fields = {} as Attributes

  if (typeof model.attributes === 'object') fields = model.attributes
  else fields = JSON.parse(model.attributes) as Attributes

  return fields
}

export async function getCurrentMigrationFields(modelPath: string): Promise<Attribute | undefined> {
  return extractAttributesFromModel(modelPath)
}
