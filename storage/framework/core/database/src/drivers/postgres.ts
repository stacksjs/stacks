import type { Ok } from '@stacksjs/error-handling'
import type { Validator } from '@stacksjs/ts-validation'
import type { Attribute, AttributesElements, Model } from '@stacksjs/types'
import { log } from '@stacksjs/logging'

function italic(str: string): string {
  return `\x1B[3m${str}\x1B[23m`
}
// Local relative imports — see drivers/mysql.ts for the cycle-deadlock rationale.
import { db } from '../utils'
import { createPasswordResetsTable } from './defaults/passwords'
import { ok } from '@stacksjs/error-handling'
// Deep import to the leaf orm/utils file — see drivers/helpers.ts for why
// we go around the orm barrel.
import { fetchOtherModelRelations, getModelName, getPivotTables, getTableName } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'
import { plural, snakeCase } from '@stacksjs/strings'
// Import from `./helpers` (not `.`) to avoid re-entering the drivers
// barrel — see `./helpers.ts` for the cycle-deadlock rationale.
import {
  arrangeColumns,
  checkPivotMigration,
  deleteFrameworkModels,
  deleteMigrationFiles,
  findDifferingKeys,
  getLastMigrationFields,
  getUpvoteTableName,
  hasTableBeenMigrated,
  isArrayEqual,
  mapFieldTypeToColumnType,
  pluckChanges,
} from './helpers'

import {
  createPostgresCategorizableTable,
  createPostgresCommentablesPivotTable,
  createPostgresCommentsTable,
  createPostgresCommentUpvoteMigration,
  createPostgresPasskeyMigration,
  createPostgresQueryLogsTable,
  createPostgresTaggablesTable,
  createPostgresTagsTable,
  dropMigrationTables,
} from './defaults/traits'

export async function dropPostgresTables(): Promise<void> {
  const tables = await fetchPostgresTables()
  const userModelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/app/Models/**/*.ts')], { absolute: true })

  await dropMigrationTables()

  for (const table of tables) await db.unsafe(`DROP TABLE IF EXISTS "${table}" CASCADE`).execute()
  await dropCommonPostgresTables()

  for (const userModel of userModelFiles) {
    const userModelPath = (await import(userModel)).default
    const pivotTables = await getPivotTables(userModelPath, userModel)
    for (const pivotTable of pivotTables) await db.unsafe(`DROP TABLE IF EXISTS "${pivotTable.table}" CASCADE`).execute()
  }
}

async function dropCommonPostgresTables(): Promise<void> {
  await db.unsafe('DROP TABLE IF EXISTS "passkeys" CASCADE').execute()
  await db.unsafe('DROP TABLE IF EXISTS "password_resets" CASCADE').execute()
  await db.unsafe('DROP TABLE IF EXISTS "query_logs" CASCADE').execute()
  await db.unsafe('DROP TABLE IF EXISTS "categorizables" CASCADE').execute()
  await db.unsafe('DROP TABLE IF EXISTS "commentables" CASCADE').execute()
  await db.unsafe('DROP TABLE IF EXISTS "comments" CASCADE').execute()
  await db.unsafe('DROP TABLE IF EXISTS "tags" CASCADE').execute()
  await db.unsafe('DROP TABLE IF EXISTS "taggables" CASCADE').execute()
  await db.unsafe('DROP TABLE IF EXISTS "commentable_upvotes" CASCADE').execute()
}

export async function generatePostgresTraitMigrations(): Promise<void> {
  await createPostgresCategorizableTable()
  await createPostgresCommentsTable()
  await createPostgresTagsTable()
  await createPostgresCommentUpvoteMigration()
  await createPostgresPasskeyMigration()
  await createPostgresQueryLogsTable()
  await createPasswordResetsTable()
  await createPostgresCommentablesPivotTable()
  await createPostgresTaggablesTable()
}

export async function resetPostgresDatabase(): Promise<Ok<string, never>> {
  await dropPostgresTables()
  await deleteFrameworkModels()
  await deleteMigrationFiles()

  await db.unsafe('CREATE TABLE IF NOT EXISTS "migrations" (id SERIAL PRIMARY KEY)').execute()
  await db.unsafe('CREATE TABLE IF NOT EXISTS "migration_locks" (id SERIAL PRIMARY KEY)').execute()
  await db.unsafe('CREATE TABLE IF NOT EXISTS "activities" (id SERIAL PRIMARY KEY)').execute()

  return ok('All tables dropped successfully!') as any
}

export async function generatePostgresMigration(modelPath: string): Promise<void> {
  // check if any files are in the database folder
  const files = await (fs.readdir as any)(path.userMigrationsPath(''))

  if ((files as any).length === 0) {
    log.debug('No migrations found in the database folder, clearing the model snapshot cache...')

    const cacheDir = path.frameworkPath('cache/models')

    if (fs.existsSync(cacheDir)) {
      const modelFiles = await (fs.readdir as any)(cacheDir)

      if ((modelFiles as any).length) {
        for (const file of modelFiles as any) {
          if (file.endsWith('.ts'))
            await (fs.unlink as any)(path.frameworkPath(`cache/models/${file}`))
        }
      }
    }
  }

  const model = (await import(modelPath)).default as Model
  const fileName = path.basename(modelPath)
  const tableName = getTableName(model, modelPath)

  const fieldsString = JSON.stringify(model.attributes, null, 2) // Pretty print the JSON
  const copiedModelPath = path.frameworkPath(`cache/models/${fileName}`)

  let haveFieldsChanged = false

  // if the file exists, we need to check if the fields have changed
  if (fs.existsSync(copiedModelPath)) {
    log.info(`Fields have already been generated for ${tableName}`)

    const previousFields = await getLastMigrationFields(fileName)
    const previousFieldsString = JSON.stringify(previousFields, null, 2) // Convert to string for comparison

    if (previousFieldsString === fieldsString) {
      log.debug(`Fields have not changed for ${tableName}`)
      return
    }

    haveFieldsChanged = true
    log.debug(`Fields have changed for ${tableName}`)
  }
  else {
    log.debug(`Fields have not been generated for ${tableName}`)
  }

  // store the fields of the model to a file
  await Bun.$`mkdir -p ${path.frameworkPath('cache/models')} && cp ${modelPath} ${copiedModelPath}`

  // if the fields have changed, we need to create a new update migration
  // if the fields have not changed, we need to migrate the table

  // we need to check if this tableName has already been migrated
  const hasBeenMigrated = await hasTableBeenMigrated(tableName)

  log.debug(`Has ${tableName} been migrated? ${hasBeenMigrated}`)

  const useBillable = model.traits?.billable || false

  if (useBillable && (tableName as string) === 'users')
    await createTableMigration(path.frameworkPath('defaults/app/Models/Subscription.ts'))

  if (haveFieldsChanged)
    await createAlterTableMigration(modelPath)
  else await createTableMigration(modelPath)
}

// eslint-disable-next-line pickier/no-unused-vars
async function createTableMigration(modelPath: string) {
  log.debug('createTableMigration modelPath:', modelPath)

  const model = (await import(modelPath)).default as Model

  const tableName = getTableName(model, modelPath)

  const twoFactorEnabled
    = model.traits?.useAuth && typeof model.traits.useAuth !== 'boolean' ? model.traits.useAuth.useTwoFactor : false

  await createPivotTableMigration(model, modelPath)

  const useTimestamps = model.traits?.useTimestamps ?? model.traits?.timestampable ?? true
  const useSocials = model?.traits?.useSocials && Array.isArray(model.traits.useSocials) && model.traits.useSocials.length > 0
  const useLikeable = model?.traits?.likeable && Array.isArray(model.traits.likeable) && model.traits.likeable.length > 0
  const useSoftDeletes = model.traits?.useSoftDeletes ?? model.traits?.softDeletable ?? false

  const usePasskey = (typeof model.traits?.useAuth === 'object' && model.traits.useAuth.usePasskey) ?? false
  const useBillable = model.traits?.billable || false
  const useUuid = model.traits?.useUuid || false

  if (useBillable && (tableName as string) === 'users')
    await createTableMigration(path.frameworkPath('defaults/app/Models/Subscription.ts'))

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(_db: Database<any>) {\n`
  migrationContent += `  await (_db as any).schema\n`
  migrationContent += `    .createTable('${tableName}')\n`

  migrationContent += `    .addColumn('id', 'serial', (col) => col.primaryKey())\n`

  if (useUuid)
    migrationContent += `    .addColumn('uuid', 'uuid', (col) => col.defaultTo(sql.raw('gen_random_uuid()')))\n`

  // Add model attributes
  for (const [fieldName, options] of arrangeColumns(model.attributes)) {
    const fieldOptions = options as Attribute
    const fieldNameFormatted = snakeCase(fieldName)
    const columnType = mapFieldTypeToColumnType(fieldOptions.validation?.rule, 'postgres')
    const isRequired = 'isRequired' in (fieldOptions.validation?.rule ?? {})
      ? (fieldOptions.validation?.rule as Validator<any>).isRequired
      : false

    migrationContent += `    .addColumn('${fieldNameFormatted}', ${columnType}`

    // Check if there are configurations that require the lambda function
    if (isRequired || fieldOptions.unique || fieldOptions.default !== undefined) {
      migrationContent += `, col => col`
      if (isRequired)
        migrationContent += `.notNull()`
      if (fieldOptions.unique)
        migrationContent += `.unique()`
      if (fieldOptions.default !== undefined) {
        if (typeof fieldOptions.default === 'string')
          migrationContent += `.defaultTo('${fieldOptions.default.replace(/'/g, "\\'")}')`
        else if (fieldOptions.default === null)
          migrationContent += `.defaultTo(null)`
        else
          migrationContent += `.defaultTo(${fieldOptions.default})`
      }
      migrationContent += ``
    }

    migrationContent += `)\n`
  }

  // Add social fields if useSocials is enabled
  if (useSocials) {
    const socials = model.traits?.useSocials || []
    if (socials.includes('google'))
      migrationContent += `    .addColumn('google_id', 'text')\n`
    if (socials.includes('github'))
      migrationContent += `    .addColumn('github_id', 'text')\n`
    if (socials.includes('twitter'))
      migrationContent += `    .addColumn('twitter_id', 'text')\n`
    if (socials.includes('facebook'))
      migrationContent += `    .addColumn('facebook_id', 'text')\n`
  }

  // Add likeable fields if useLikeable is enabled
  if (useLikeable) {
    const likeables = Array.isArray(model.traits?.likeable) ? model.traits.likeable : []
    for (const likeable of likeables) {
      migrationContent += `    .addColumn('${likeable}_count', 'integer', (col) => col.defaultTo(0))\n`
    }
  }

  if (twoFactorEnabled !== false && twoFactorEnabled)
    migrationContent += `    .addColumn('two_factor_secret', 'text')\n`

  if (useBillable)
    migrationContent += `    .addColumn('stripe_id', 'text')\n`

  if (usePasskey)
    migrationContent += `    .addColumn('public_passkey', 'text')\n`

  // Append created_at and updated_at columns if useTimestamps is true
  if (useTimestamps) {
    // Use timestamptz on PostgreSQL — `timestamp` (without time zone)
    // stores the wall-clock instant the writer's client *thought* was
    // local time, which fractures across deployments running in
    // different TZs. timestamptz normalizes everything to UTC at write
    // and renders in the reader's session TZ, which is what app code
    // assumes when it does `new Date(row.created_at)`.
    migrationContent += `    .addColumn('created_at', 'timestamptz', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
    migrationContent += `    .addColumn('updated_at', 'timestamptz')\n`
  }

  // Append deleted_at column if useSoftDeletes is true
  if (useSoftDeletes)
    migrationContent += `    .addColumn('deleted_at', 'timestamptz')\n`

  migrationContent += `    .execute()\n`

  migrationContent += generatePrimaryKeyIndexSQL(tableName)

  // Add upvote table if useLikeable is enabled
  if (useLikeable) {
    const upvoteTable = getUpvoteTableName(model, tableName)
    if (upvoteTable) {
      migrationContent += `\n  // Create upvote table\n`
      migrationContent += `  await (_db as any).schema\n`
      migrationContent += `    .createTable('${upvoteTable}')\n`
      migrationContent += `    .addColumn('id', 'serial', (col) => col.primaryKey())\n`
      migrationContent += `    .addColumn('${tableName}_id', 'integer', (col) => col.notNull())\n`
      migrationContent += `    .addColumn('user_id', 'integer', (col) => col.notNull())\n`
      // Use timestamptz on PostgreSQL — same convention as the main
      // model table above (stacksjs/stacks#1876 D-5). Without this,
      // the upvote table drifted to plain `timestamp` (no TZ) while
      // its parent table used `timestamptz`, so cross-table joins
      // returned mismatched values for the same instant.
      migrationContent += `    .addColumn('created_at', 'timestamptz', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
      migrationContent += `    .addColumn('updated_at', 'timestamptz')\n`
      migrationContent += `    .execute()\n\n`
      migrationContent += `  // Add indexes for upvote table\n`
      migrationContent += `  await (_db as any).schema.createIndex('${upvoteTable}_${tableName}_id_index').on('${upvoteTable}').column('${tableName}_id').execute()\n`
      migrationContent += `  await (_db as any).schema.createIndex('${upvoteTable}_user_id_index').on('${upvoteTable}').column('user_id').execute()\n`
      migrationContent += `  await (_db as any).schema.createIndex('${upvoteTable}_id_index').on('${upvoteTable}').column('id').execute()\n`
    }
  }

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-${tableName}-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  await Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

// `createPostgresForeignKeyMigrations` + `createCompositeIndexMigration`
// used to live here — both were never called from anywhere in the
// codebase. The FK migrations they generated have been redundant
// since stacksjs/bun-query-builder#1019 (and #1916) — bqb emits the
// equivalent `ALTER TABLE … ADD CONSTRAINT FOREIGN KEY` statements
// inside its own migration plan. Removed in #1916 Phase 2.

async function createPivotTableMigration(model: Model, modelPath: string) {
  const pivotTables = await getPivotTables(model, modelPath)
  const processedPivotTables = new Set<string>()

  if (!pivotTables.length)
    return

  for (const pivotTable of pivotTables) {
    // Skip if this pivot table has already been processed
    if (processedPivotTables.has(pivotTable.table)) {
      continue
    }

    const hasBeenMigrated = await checkPivotMigration(pivotTable.table)

    if (hasBeenMigrated) {
      processedPivotTables.add(pivotTable.table)
      continue
    }

    let migrationContent = `import type { Database } from '@stacksjs/database'\n`
    migrationContent += `import { sql } from '@stacksjs/database'\n\n`
    // eslint-disable-next-line pickier/no-unused-vars
    migrationContent += `export async function up(db: Database<any>) {\n`
    migrationContent += `  await (db as any).schema\n`
    migrationContent += `    .createTable('${pivotTable.table}')\n`
    migrationContent += `    .addColumn('id', 'serial', (col) => col.primaryKey())\n`
    migrationContent += `    .addColumn('${pivotTable.firstForeignKey}', 'integer', (col) => col.notNull())\n`
    migrationContent += `    .addColumn('${pivotTable.secondForeignKey}', 'integer', (col) => col.notNull())\n`
    // Use timestamptz on PostgreSQL to match the parent table
    // convention (see :275). Cross-table joins on created_at
    // returned mismatched values when the pivot drifted to plain
    // `timestamp` (no TZ) while the parent used `timestamptz`.
    // Same D-5 fix that the upvote table got in #1876; this was the
    // missed m2m sibling. See stacksjs/stacks#1915.
    migrationContent += `    .addColumn('created_at', 'timestamptz', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
    migrationContent += `    .execute()\n\n`

    // Add foreign key constraints
    migrationContent += `  await (_db as any).schema\n`
    migrationContent += `    .alterTable('${pivotTable.table}')\n`
    migrationContent += `    .addForeignKeyConstraint('${pivotTable.table}_${pivotTable.firstForeignKey}_fkey', ['${pivotTable.firstForeignKey}'], '${plural(pivotTable.firstForeignKey?.replace(/_id$/, '') || '')}', ['id'], (cb) => cb.onDelete('cascade'))\n`
    migrationContent += `    .execute()\n\n`

    // Add unique constraint to prevent duplicate relationships
    migrationContent += `  await (_db as any).schema\n`
    migrationContent += `    .alterTable('${pivotTable.table}')\n`
    migrationContent += `    .addUniqueConstraint('${pivotTable.table}_unique', ['${pivotTable.firstForeignKey}', '${pivotTable.secondForeignKey}'])\n`
    migrationContent += `    .execute()\n\n`

    // Add indexes for better query performance
    migrationContent += `  await (_db as any).schema\n`
    migrationContent += `    .createIndex('${pivotTable.table}_${pivotTable.firstForeignKey}_idx')\n`
    migrationContent += `    .on('${pivotTable.table}')\n`
    migrationContent += `    .column('${pivotTable.firstForeignKey}')\n`
    migrationContent += `    .execute()\n\n`

    migrationContent += `  await (_db as any).schema\n`
    migrationContent += `    .createIndex('${pivotTable.table}_${pivotTable.secondForeignKey}_idx')\n`
    migrationContent += `    .on('${pivotTable.table}')\n`
    migrationContent += `    .column('${pivotTable.secondForeignKey}')\n`
    migrationContent += `    .execute()\n`

    migrationContent += `}\n`

    const timestamp = new Date().getTime().toString()
    const migrationFileName = `${timestamp}-create-${pivotTable.table}-table.ts`
    const migrationFilePath = path.userMigrationsPath(migrationFileName)

    await Bun.write(migrationFilePath, migrationContent)

    // Mark this pivot table as processed
    processedPivotTables.add(pivotTable.table)

    log.success(`Created migration: ${italic(migrationFileName)}`)
  }
}

async function createAlterTableMigration(modelPath: string) {
  const model = (await import(modelPath)).default as Model
  const modelName = getModelName(model, modelPath)
  const tableName = getTableName(model, modelPath)
  let hasChanged = false

  // Assuming you have a function to get the fields from the last migration
  // For simplicity, this is not implemented here
  const lastMigrationFields = await getLastMigrationFields(modelName)
  const lastFields = lastMigrationFields ?? {}
  const currentFields = model.attributes as AttributesElements

  // Determine fields to add and remove
  const changes = pluckChanges(Object.keys(lastFields), Object.keys(currentFields))
  const fieldsToAdd = changes?.added || []
  const fieldsToRemove = changes?.removed || []

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  // eslint-disable-next-line pickier/no-unused-vars
  migrationContent += `export async function up(db: Database<any>) {\n`

  if (fieldsToAdd.length || fieldsToRemove.length) {
    hasChanged = true
    migrationContent += `  await (_db as any).schema.alterTable('${tableName}')\n`
  }

  // Add new fields
  for (const fieldName of fieldsToAdd) {
    const options = currentFields[fieldName] as Attribute
    const columnType = mapFieldTypeToColumnType(options.validation?.rule, 'postgres')
    const formattedFieldName = snakeCase(fieldName)
    const isRequired = 'isRequired' in (options.validation?.rule ?? {})
      ? (options.validation?.rule as Validator<any>).isRequired
      : false

    migrationContent += `    .addColumn('${formattedFieldName}', '${columnType}'`

    // Check if there are configurations that require the lambda function
    if (isRequired || options.unique || options.default !== undefined) {
      migrationContent += `, col => col`
      if (isRequired)
        migrationContent += `.notNull()`
      if (options.unique)
        migrationContent += `.unique()`
      if (options.default !== undefined) {
        if (typeof options.default === 'string')
          migrationContent += `.defaultTo('${options.default}')`
        else if (options.default === null)
          migrationContent += `.defaultTo(null)`
        else
          migrationContent += `.defaultTo(${options.default})`
      }
      migrationContent += ``
    }

    migrationContent += `)\n`
  }

  // Remove fields that no longer exist
  for (const fieldName of fieldsToRemove) migrationContent += `    .dropColumn('${fieldName}')\n`

  const fieldValidations = findDifferingKeys(lastFields, currentFields)
  for (const fieldValidation of fieldValidations) {
    hasChanged = true
    const fieldNameFormatted = snakeCase(fieldValidation.key)
    // PostgreSQL uses ALTER COLUMN for type changes
    migrationContent += `    .alterColumn('${fieldNameFormatted}', (col) => col.setDataType('text'))\n`
  }

  // Add column rearrangement logic
  const lastFieldOrder = Object.values(lastFields).map(attr => attr.order)
  const currentFieldOrder = Object.values(currentFields).map(attr => attr.order)

  if (!isArrayEqual(lastFieldOrder, currentFieldOrder)) {
    hasChanged = true
  }

  if (hasChanged) {
    migrationContent += `    .execute()\n`
    migrationContent += `}\n`

    const timestamp = new Date().getTime().toString()
    const migrationFileName = `${timestamp}-alter-${tableName}-table.ts`
    const migrationFilePath = path.userMigrationsPath(migrationFileName)

    await Bun.write(migrationFilePath, migrationContent)
    log.success(`Created alter migration: ${italic(migrationFileName)}`)
  }
}

export function generateIndexCreationSQL(
  tableName: string,
  index: { name: string, columns: string[], unique?: boolean, where?: string },
): string {
  // Partial / multi-column unique indexes (stacksjs/stacks#1943) — emit
  // raw SQL via `db.unsafe(...)` for the UNIQUE / WHERE forms so we
  // don't have to thread kysely's `sql` template tag into generated
  // migration imports.
  if (index.unique || index.where) {
    const unique = index.unique ? 'UNIQUE ' : ''
    const cols = index.columns.map(col => snakeCase(col)).join(', ')
    const whereClause = index.where ? ` WHERE ${index.where}` : ''
    return `  await db.unsafe(\`CREATE ${unique}INDEX IF NOT EXISTS "${index.name}" ON "${tableName}" (${cols})${whereClause}\`).execute()\n`
  }
  const columnsStr = index.columns.map(col => `'${snakeCase(col)}'`).join(', ')
  return `  await (_db as any).schema.createIndex('${index.name}').on('${tableName}').columns([${columnsStr}]).execute()\n`
}

function generatePrimaryKeyIndexSQL(tableName: string): string {
  return `  await (_db as any).schema.createIndex('${tableName}_id_index').on('${tableName}').column('id').execute()\n`
}

function generateForeignKeyIndexSQL(tableName: string, foreignKey: string): string {
  return `  await (_db as any).schema.createIndex('${tableName}_${foreignKey}_index').on('${tableName}').column('${foreignKey}').execute()\n\n`
}

export async function fetchPostgresTables(): Promise<string[]> {
  const modelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/app/Models/**/*.ts')], { absolute: true })

  const tables: string[] = []

  for (const modelPath of modelFiles) {
    const model = (await import(modelPath)).default
    const tableName = getTableName(model, modelPath)

    tables.push(tableName)
  }

  return tables
}
