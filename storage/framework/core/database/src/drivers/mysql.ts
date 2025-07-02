import type { Ok } from '@stacksjs/error-handling'
import type { Validator } from '@stacksjs/ts-validation'
import type { Attribute, AttributesElements, Model } from '@stacksjs/types'
import { italic, log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'
import { ok } from '@stacksjs/error-handling'
import { fetchOtherModelRelations, getModelName, getPivotTables, getTableName } from '@stacksjs/orm'

import { path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'
import { snakeCase } from '@stacksjs/strings'
import {
  arrangeColumns,
  checkPivotMigration,
  deleteFrameworkModels,
  deleteMigrationFiles,
  fetchTables,
  findDifferingKeys,
  getLastMigrationFields,
  getUpvoteTableName,
  hasTableBeenMigrated,
  isArrayEqual,
  mapFieldTypeToColumnType,
  pluckChanges,
} from '.'

import { dropCommonTables } from './defaults/traits'

export async function resetMysqlDatabase(): Promise<Ok<string, never>> {
  await dropMysqlTables()
  await deleteFrameworkModels()
  await deleteMigrationFiles()

  return ok('All tables dropped successfully!')
}

export async function dropMysqlTables(): Promise<void> {
  const modelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/models/**/*.ts')], { absolute: true })
  const tables = await fetchTables()

  for (const table of tables) await db.schema.dropTable(table).ifExists().execute()
  await dropCommonTables()

  for (const userModel of modelFiles) {
    const userModelPath = (await import(userModel)).default
    const pivotTables = await getPivotTables(userModelPath, userModel)

    for (const pivotTable of pivotTables) await db.schema.dropTable(pivotTable.table).ifExists().execute()
  }
}

export async function generateMysqlMigration(modelPath: string): Promise<void> {
  // check if any files are in the database folder
  // const files = await fs.readdir(path.userMigrationsPath())

  // if (files.length === 0) {
  //   log.debug('No migrations found in the database folder, deleting all framework/database/*.json files...')

  //   // delete the *.ts files in the models folder
  //   const modelFiles = await fs.readdir(path.frameworkPath('models'))

  //   if (modelFiles.length) {
  //     log.debug('No existing model files in framework path...')

  //     for (const file of modelFiles) {
  //       if (file.endsWith('.ts')) await fs.unlink(path.frameworkPath(`models/${file}`))
  //     }
  //   }
  // }

  const model = (await import(modelPath)).default as Model
  const fileName = path.basename(modelPath)
  const tableName = getTableName(model, modelPath)

  const fieldsString = JSON.stringify(model.attributes, null, 2) // Pretty print the JSON
  const copiedModelPath = path.frameworkPath(`models/${fileName}`)

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
  await Bun.$`cp ${modelPath} ${copiedModelPath}`

  // if the fields have changed, we need to create a new update migration
  // if the fields have not changed, we need to migrate the table

  // we need to check if this tableName has already been migrated
  const hasBeenMigrated = await hasTableBeenMigrated(tableName as string)

  log.debug(`Has ${tableName} been migrated? ${hasBeenMigrated}`)

  if (haveFieldsChanged)
    await createAlterTableMigration(modelPath)
  else await createTableMigration(modelPath)
}

async function createTableMigration(modelPath: string): Promise<void> {
  log.debug('createTableMigration modelPath:', modelPath)

  const model = (await import(modelPath)).default as Model
  const modelName = getModelName(model, modelPath)
  const tableName = getTableName(model, modelPath)

  const twoFactorEnabled
    = model.traits?.useAuth && typeof model.traits.useAuth !== 'boolean' ? model.traits.useAuth.useTwoFactor : false

  await createPivotTableMigration(model, modelPath)
  const otherModelRelations = await fetchOtherModelRelations(modelName)

  const useTimestamps = model?.traits?.useTimestamps ?? model?.traits?.timestampable ?? true
  const useSocials = model?.traits?.useSocials && Array.isArray(model.traits.useSocials) && model.traits.useSocials.length > 0
  const useLikeable = model?.traits?.likeable && Array.isArray(model.traits.likeable) && model.traits.likeable.length > 0
  const useSoftDeletes = model?.traits?.useSoftDeletes ?? model?.traits?.softDeletable ?? false

  const usePasskey = (typeof model.traits?.useAuth === 'object' && model.traits.useAuth.usePasskey) ?? false
  const useBillable = model.traits?.billable || false
  const useUuid = model.traits?.useUuid || false

  if (useBillable && tableName === 'users')
    await createTableMigration(path.storagePath('framework/models/generated/Subscription.ts'))

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
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
          migrationContent += `.defaultTo('${fieldOptions.default}')`
        else if (fieldOptions.default === null)
          migrationContent += `.defaultTo(null)`
        else
          migrationContent += `.defaultTo(${fieldOptions.default})`
      }
      migrationContent += ``
    }

    migrationContent += `)\n`
  }

  if (otherModelRelations?.length) {
    for (const modelRelation of otherModelRelations) {
      if (!modelRelation.foreignKey)
        continue

      migrationContent += `    .addColumn('${modelRelation.foreignKey}', 'integer', (col) =>
        col.references('${modelRelation.relationTable}.id').onDelete('cascade')
      ) \n`
    }
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

  // Add composite indexes if defined
  if (model.indexes?.length) {
    migrationContent += '\n'
    for (const index of model.indexes) {
      migrationContent += generateIndexCreationSQL(tableName, index.name, index.columns)
    }
  }

  if (otherModelRelations?.length) {
    for (const modelRelation of otherModelRelations) {
      if (!modelRelation.foreignKey)
        continue

      migrationContent += generateForeignKeyIndexSQL(tableName, modelRelation.foreignKey)
    }
  }

  migrationContent += generatePrimaryKeyIndexSQL(tableName)

  // Add upvote table if useLikeable is enabled
  if (useLikeable) {
    const upvoteTable = getUpvoteTableName(model, tableName)
    if (upvoteTable) {
      migrationContent += `\n  // Create upvote table\n`
      migrationContent += `  await db.schema\n`
      migrationContent += `    .createTable('${upvoteTable}')\n`
      migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
      migrationContent += `    .addColumn('${tableName}_id', 'integer', col => col.notNull())\n`
      migrationContent += `    .addColumn('user_id', 'integer', col => col.notNull())\n`
      migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
      migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
      migrationContent += `    .execute()\n\n`
      migrationContent += `  // Add indexes for upvote table\n`
      migrationContent += `  await db.schema.createIndex('${upvoteTable}_${tableName}_id_index').on('${upvoteTable}').column('${tableName}_id').execute()\n`
      migrationContent += `  await db.schema.createIndex('${upvoteTable}_user_id_index').on('${upvoteTable}').column('user_id').execute()\n`
      migrationContent += `  await db.schema.createIndex('${upvoteTable}_id_index').on('${upvoteTable}').column('id').execute()\n`
    }
  }

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-${tableName}-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  // eslint-disable-next-line no-console
  console.log(migrationFilePath)

  Bun.write(migrationFilePath, migrationContent)

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
    migrationContent += `export async function up(db: Database<any>) {\n`
    migrationContent += `  await db.schema\n`
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

    Bun.write(migrationFilePath, migrationContent)

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
  migrationContent += `export async function up(db: Database<any>) {\n`

  if (fieldsToAdd.length || fieldsToRemove.length) {
    hasChanged = true
    migrationContent += `  await db.schema.alterTable('${tableName}')\n`
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

    Bun.write(migrationFilePath, migrationContent)
    log.success(`Created alter migration: ${italic(migrationFileName)}`)
  }
}

function generateIndexCreationSQL(tableName: string, indexName: string, columns: string[]): string {
  const columnsStr = columns.map(col => `'${snakeCase(col)}'`).join(', ')
  return `  await db.schema.createIndex('${indexName}').on('${tableName}').columns([${columnsStr}]).execute()\n`
}

function generatePrimaryKeyIndexSQL(tableName: string): string {
  return `  await db.schema.createIndex('${tableName}_id_index').on('${tableName}').column('id').execute()\n`
}

function generateForeignKeyIndexSQL(tableName: string, foreignKey: string): string {
  return `  await db.schema.createIndex('${tableName}_${foreignKey}_index').on('${tableName}').column('${foreignKey}').execute()\n\n`
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
