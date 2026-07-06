import type { Ok } from '@stacksjs/error-handling'
import type { Validator } from '@stacksjs/ts-validation'
import type { Attribute, AttributesElements, Model } from '@stacksjs/types'
import { log } from '@stacksjs/logging'

function italic(str: string): string {
  return `\x1B[3m${str}\x1B[23m`
}
// Local relative imports rather than '@stacksjs/database' — the package's
// own root re-exports `./drivers/*`, so importing it from inside a driver
// creates a self-cycle that deadlocks bun's module loader (60s @ 99% CPU)
// when @stacksjs/database is imported at top-level outside the framework's
// preloader context (e.g. by `bun test`).
import { db } from '../utils'
import { createPasswordResetsTable } from './defaults/passwords'
import { ok } from '@stacksjs/error-handling'
// Deep import to the leaf orm/utils file — see drivers/helpers.ts for why
// we go around the orm barrel (the barrel re-exports `./db` which loops
// back into @stacksjs/database and deadlocks bun's loader).
import { fetchOtherModelRelations, getModelName, getPivotTables, getTableName } from '@stacksjs/orm'

import { path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'
import { snakeCase } from '@stacksjs/strings'
// Import from `./helpers` (not `.`) to avoid re-entering the drivers
// barrel — see `./helpers.ts` for the cycle-deadlock rationale.
import {
  arrangeColumns,
  checkPivotMigration,
  deleteFrameworkModels,
  deleteMigrationFiles,
  fetchTables,
  findDifferingKeys,
  getLastMigrationFields,
  getLikeableForeignKey,
  getUpvoteTableName,
  hasTableBeenMigrated,
  isArrayEqual,
  mapFieldTypeToColumnType,
  pluckChanges,
} from './helpers'

import { createCategorizableTable, createCommentablesTable, createCommentUpvoteMigration, createPasskeyMigration, createQueryLogsTable, createTaggablesTable, createTaggableTable, dropCommonTables } from './defaults/traits'

export async function resetMysqlDatabase(): Promise<Ok<string, never>> {
  await dropMysqlTables()
  await deleteFrameworkModels()
  await deleteMigrationFiles()

  return ok('All tables dropped successfully!') as any
}

export async function dropMysqlTables(): Promise<void> {
  const modelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/app/Models/**/*.ts')], { absolute: true })
  const tables = await fetchTables()

  for (const table of tables) {
    // Validate table name comes from `fetchTables()` (i.e. information_schema)
    // and matches a safe identifier pattern before splicing into raw SQL.
    // Even though our caller is internal, treating this as untrusted input
    // catches bugs where a name accidentally contains a backtick or
    // whitespace and protects against future callers passing user input.
    if (!/^[a-z_][\w]*$/i.test(table)) {
      throw new Error(`[mysql] Refusing to drop table with unsafe name: ${table}`)
    }
    await db.unsafe(`DROP TABLE IF EXISTS \`${table}\``).execute()
  }
  await dropCommonTables()

  for (const userModel of modelFiles) {
    const userModelPath = (await import(userModel)).default
    const pivotTables = await getPivotTables(userModelPath, userModel)

    for (const pivotTable of pivotTables) {
      if (!/^[a-z_][\w]*$/i.test(pivotTable.table)) {
        throw new Error(`[mysql] Refusing to drop pivot table with unsafe name: ${pivotTable.table}`)
      }
      await db.unsafe(`DROP TABLE IF EXISTS \`${pivotTable.table}\``).execute()
    }
  }
}

export async function generateMysqlMigration(modelPath: string): Promise<void> {
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
  const hasBeenMigrated = await hasTableBeenMigrated(tableName as string)

  log.debug(`Has ${tableName} been migrated? ${hasBeenMigrated}`)

  if (haveFieldsChanged)
    await createAlterTableMigration(modelPath)
  else await createTableMigration(modelPath)
}

export async function generateMysqlTraitMigrations(): Promise<void> {
  await Promise.all([
    createCategorizableTable(),
    createCommentablesTable(),
    createTaggableTable(),
    createTaggablesTable(),
    createPasswordResetsTable(),
    createPasskeyMigration(),
    createQueryLogsTable(),
    createCommentUpvoteMigration(),
  ])
}

// `createMysqlForeignKeyMigrations` + `createCompositeIndexMigration`
// used to live here — both were never called from anywhere in the
// codebase. The FK migrations they generated have been redundant
// since stacksjs/bun-query-builder#1019 (and #1916) — bqb emits the
// equivalent `ALTER TABLE … ADD CONSTRAINT FOREIGN KEY` statements
// inside its own migration plan. Removed in #1916 Phase 2.

// eslint-disable-next-line pickier/no-unused-vars
async function createTableMigration(modelPath: string): Promise<void> {
  log.debug('createTableMigration modelPath:', modelPath)

  const model = (await import(modelPath)).default as Model
  const tableName = getTableName(model, modelPath)

  const twoFactorEnabled
    = model.traits?.useAuth && typeof model.traits.useAuth !== 'boolean' ? model.traits.useAuth.useTwoFactor : false

  await createPivotTableMigration(model, modelPath)

  const useTimestamps = model?.traits?.useTimestamps ?? model?.traits?.timestampable ?? true
  const useSocials = model?.traits?.useSocials && Array.isArray(model.traits.useSocials) && model.traits.useSocials.length > 0
  // The typed forms are `boolean | LikeableOptions` — neither is an array,
  // so requiring a non-empty array meant no typed model could ever get a
  // pivot while the runtime trait activates for any truthy value
  // (stacksjs/stacks#1954). Legacy empty arrays stay a no-op.
  const useLikeable = Array.isArray(model?.traits?.likeable) ? model.traits.likeable.length > 0 : Boolean(model?.traits?.likeable)
  const useSoftDeletes = model?.traits?.useSoftDeletes ?? model?.traits?.softDeletable ?? false

  const usePasskey = (typeof model.traits?.useAuth === 'object' && model.traits.useAuth.usePasskey) ?? false
  const useBillable = model.traits?.billable || false
  const useUuid = model.traits?.useUuid || false

  if (useBillable && (tableName as string) === 'users')
    await createTableMigration(path.frameworkPath('defaults/app/Models/Subscription.ts'))

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  // eslint-disable-next-line pickier/no-unused-vars
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await (db as any).schema\n`
  migrationContent += `    .createTable('${tableName}')\n`
  migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`

  if (useUuid)
    migrationContent += `    .addColumn('uuid', 'varchar(255)')\n`

  if (useSocials) {
    const socials = model.traits?.useSocials || []

    if (socials.includes('google'))
      migrationContent += `    .addColumn('google_id', 'varchar(255)')\n`
    if (socials.includes('github'))
      migrationContent += `    .addColumn('github_id', 'varchar(255)')\n`
    if (socials.includes('apple'))
      migrationContent += `    .addColumn('apple_id', 'varchar(255)')\n`
    if (socials.includes('twitter'))
      migrationContent += `    .addColumn('twitter_id', 'varchar(255)')\n`
    if (socials.includes('facebook'))
      migrationContent += `    .addColumn('facebook_id', 'varchar(255)')\n`
  }

  for (const [fieldName, options] of arrangeColumns(model.attributes)) {
    const fieldOptions = options as Attribute
    const fieldNameFormatted = snakeCase(fieldName)

    const columnType = mapFieldTypeToColumnType(fieldOptions.validation?.rule)
    migrationContent += `    .addColumn('${fieldNameFormatted}', ${columnType}`

    const isRequired = 'isRequired' in (fieldOptions.validation?.rule ?? {})
      ? (fieldOptions.validation?.rule as Validator<any>).isRequired
      : false

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

  if (twoFactorEnabled !== false && twoFactorEnabled)
    migrationContent += `    .addColumn('two_factor_secret', 'varchar(255)')\n`

  if (useBillable)
    migrationContent += `    .addColumn('stripe_id', 'varchar(255)')\n`

  if (usePasskey)
    migrationContent += `    .addColumn('public_passkey', 'varchar(255)')\n`

  // Append created_at and updated_at columns if useTimestamps is true
  if (useTimestamps) {
    migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
    migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  }

  // Append deleted_at column if useSoftDeletes is true
  if (useSoftDeletes)
    migrationContent += `    .addColumn('deleted_at', 'timestamp')\n`

  migrationContent += `    .execute()\n`

  migrationContent += generatePrimaryKeyIndexSQL(tableName)

  // Add upvote table if useLikeable is enabled
  if (useLikeable) {
    const upvoteTable = getUpvoteTableName(model, tableName)
    if (upvoteTable) {
      // Singular FK — must match the runtime trait default or like()
      // can't write to the generated table (see getLikeableForeignKey).
      const foreignKey = getLikeableForeignKey(model, tableName)
      // Emitted references must use `db` — the generated up() signature
      // above is `up(db: Database<any>)`; `_db` was a ReferenceError.
      migrationContent += `\n  // Create upvote table\n`
      migrationContent += `  await (db as any).schema\n`
      migrationContent += `    .createTable('${upvoteTable}')\n`
      migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
      migrationContent += `    .addColumn('${foreignKey}', 'integer', col => col.notNull())\n`
      migrationContent += `    .addColumn('user_id', 'integer', col => col.notNull())\n`
      migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
      migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
      migrationContent += `    .execute()\n\n`
      migrationContent += `  // Add indexes for upvote table\n`
      migrationContent += `  await (db as any).schema.createIndex('${upvoteTable}_${foreignKey}_index').on('${upvoteTable}').column('${foreignKey}').execute()\n`
      // Composite UNIQUE (user_id, fk) — backs the trait's idempotent
      // like(): duplicate inserts throw ER_DUP_ENTRY (errno 1062) and the
      // catch returns the existing row instead of double-counting.
      migrationContent += `  await (db as any).schema.createIndex('${upvoteTable}_user_${foreignKey}_unique').on('${upvoteTable}').columns(['user_id', '${foreignKey}']).unique().execute()\n`
      migrationContent += `  await (db as any).schema.createIndex('${upvoteTable}_id_index').on('${upvoteTable}').column('id').execute()\n`
    }
  }

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-${tableName}-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  log.debug(migrationFilePath)

  await Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

async function createPivotTableMigration(model: Model, modelPath: string): Promise<void> {
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
    migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
    migrationContent += `    .addColumn('${pivotTable.firstForeignKey}', 'integer')\n`
    migrationContent += `    .addColumn('${pivotTable.secondForeignKey}', 'integer')\n`
    migrationContent += `    .addColumn('created_at', 'timestamp', col => col.defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
    migrationContent += `    .execute()\n`
    migrationContent += `    }\n`

    const timestamp = new Date().getTime().toString()
    const migrationFileName = `${timestamp}-create-${pivotTable.table}-table.ts`

    const migrationFilePath = path.userMigrationsPath(migrationFileName)

    await Bun.write(migrationFilePath, migrationContent)

    // Mark this pivot table as processed
    processedPivotTables.add(pivotTable.table)

    log.success(`Created pivot migration: ${migrationFileName}`)
  }
}

export async function createAlterTableMigration(modelPath: string): Promise<void> {
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
    // Emitted references must use `db` — the generated up() signature
    // above is `up(db: Database<any>)`; `_db` was a ReferenceError.
    migrationContent += `  await (db as any).schema.alterTable('${tableName}')\n`
  }

  const fieldValidations = findDifferingKeys(lastFields, currentFields)
  for (const fieldValidation of fieldValidations) {
    hasChanged = true
    const fieldNameFormatted = snakeCase(fieldValidation.key)
    migrationContent += `    .modifyColumn('${fieldNameFormatted}', 'varchar(${fieldValidation.max})')\n`
  }

  // Add column rearrangement logic
  const lastFieldOrder = Object.values(lastFields).map(attr => attr.order)
  const currentFieldOrder = Object.values(currentFields).map(attr => attr.order)

  if (!isArrayEqual(lastFieldOrder, currentFieldOrder)) {
    hasChanged = true
    migrationContent += reArrangeColumns(model.attributes, tableName)
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
    return `  await db.unsafe(\`CREATE ${unique}INDEX IF NOT EXISTS \\\`${index.name}\\\` ON \\\`${tableName}\\\` (${cols})${whereClause}\`).execute()\n`
  }
  const columnsStr = index.columns.map(col => `'${snakeCase(col)}'`).join(', ')
  return `  await (db as any).schema.createIndex('${index.name}').on('${tableName}').columns([${columnsStr}]).execute()\n`
}

// These helpers are spliced into generated up(db) bodies, so the emitted
// references must use `db` — `_db` was a ReferenceError at migration time.
function generatePrimaryKeyIndexSQL(tableName: string): string {
  return `  await (db as any).schema.createIndex('${tableName}_id_index').on('${tableName}').column('id').execute()\n`
}

function generateForeignKeyIndexSQL(tableName: string, foreignKey: string): string {
  return `  await (db as any).schema.createIndex('${tableName}_${foreignKey}_index').on('${tableName}').column('${foreignKey}').execute()\n\n`
}

function reArrangeColumns(attributes: AttributesElements | undefined, tableName: string): string {
  const fields = arrangeColumns(attributes)
  let migrationContent = ''

  let previousField = ''
  for (const [fieldName] of fields) {
    const fieldNameFormatted = snakeCase(fieldName)

    if (previousField) {
      migrationContent += `await sql\`
        ALTER TABLE ${tableName}
        MODIFY COLUMN ${fieldNameFormatted} VARCHAR(255) NOT NULL AFTER ${snakeCase(previousField)};
      \`.execute(db)\n\n`
    }

    previousField = fieldNameFormatted
  }

  return migrationContent
}
