import type { Ok } from '@stacksjs/error-handling'
import type { Attribute, AttributesElements, Model } from '@stacksjs/types'
import { italic, log } from '@stacksjs/cli'
import { app } from '@stacksjs/config'
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
  isArrayEqual,
  mapFieldTypeToColumnType,
  pluckChanges,
} from '.'
import { dropCommonTables } from './defaults/traits'

export async function resetSqliteDatabase(): Promise<Ok<string, never>> {
  await deleteFrameworkModels()
  await deleteMigrationFiles()
  await dropSqliteTables()

  return ok('All tables dropped successfully!')
}

export async function dropSqliteTables(): Promise<void> {
  const userModelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/models/**/*.ts')], { absolute: true })
  const tables = await fetchTables()

  for (const table of tables) await db.schema.dropTable(table).ifExists().execute()
  await dropCommonTables()

  for (const userModel of userModelFiles) {
    const userModelPath = (await import(userModel)).default
    const pivotTables = await getPivotTables(userModelPath, userModel)

    for (const pivotTable of pivotTables) await db.schema.dropTable(pivotTable.table).ifExists().execute()
  }
}

export function fetchSqliteFile(): string {
  if (app.env === 'testing') {
    return fetchTestSqliteFile()
  }

  return path.userDatabasePath('stacks.sqlite')
}

export function fetchTestSqliteFile(): string {
  return path.userDatabasePath('stacks_testing.sqlite')
}

export async function generateSqliteMigration(modelPath: string): Promise<void> {
  // check if any files are in the database folder
  // const files = await fs.readdir(path.userMigrationsPath())

  // if (files.length === 0) {
  //   log.debug('No migrations found in the database folder, deleting all framework/database/*.json files...')

  //   // delete the *.ts files in the models folder
  //   const modelFiles = await fs.readdir(path.frameworkPath('models'))

  //   if (modelFiles.length) {
  //     log.debug('No existing model files in framework path...')

  //     for (const file of modelFiles)
  //       if (file.endsWith('.ts')) await fs.unlink(path.frameworkPath(`models/${file}`))
  //   }
  // }

  const model = (await import(modelPath)).default as Model
  const fileName = path.basename(modelPath)
  const tableName = await getTableName(model, modelPath)

  const fieldsString = JSON.stringify(model.attributes, null, 2) // Pretty print the JSON
  const copiedModelPath = path.frameworkPath(`models/${fileName}`)

  let haveFieldsChanged = false

  // if the file exists, we need to check if the fields have changed
  if (fs.existsSync(copiedModelPath)) {
    log.debug(`Fields have already been generated for ${tableName}`)

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
  const hasBeenMigrated = false

  log.debug(`Has ${tableName} been migrated? ${hasBeenMigrated}`)

  if (haveFieldsChanged)
    await createAlterTableMigration(modelPath)
  else await createTableMigration(modelPath)
}

export async function copyModelFiles(modelPath: string): Promise<void> {
  const model = (await import(modelPath)).default as Model
  const fileName = path.basename(modelPath)
  const tableName = await getTableName(model, modelPath)

  const fieldsString = JSON.stringify(model.attributes, null, 2) // Pretty print the JSON
  const copiedModelPath = path.frameworkPath(`models/${fileName}`)

  // if the file exists, we need to check if the fields have changed
  if (fs.existsSync(copiedModelPath)) {
    log.debug(`Fields have already been generated for ${tableName}`)

    const previousFields = await getLastMigrationFields(fileName)
    const previousFieldsString = JSON.stringify(previousFields, null, 2) // Convert to string for comparison

    if (previousFieldsString === fieldsString) {
      log.debug(`Fields have not changed for ${tableName}`)
      return
    }
  }

  // store the fields of the model to a file
  await Bun.$`cp ${modelPath} ${copiedModelPath}`
}

async function createTableMigration(modelPath: string) {
  log.debug('createTableMigration modelPath:', modelPath)

  const model = (await import(modelPath)).default as Model
  const tableName = getTableName(model, modelPath)
  const modelName = getModelName(model, modelPath)

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

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('${tableName}')\n`
  migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`

  if (useUuid)
    migrationContent += `    .addColumn('uuid', 'text')\n`

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

  for (const [fieldName, options] of arrangeColumns(model.attributes)) {
    const fieldOptions = options as Attribute
    const fieldNameFormatted = snakeCase(fieldName)

    const columnType = mapFieldTypeToColumnType(fieldOptions.validation?.rule, 'sqlite')
    migrationContent += `    .addColumn('${fieldNameFormatted}', ${columnType}`

    const isRequired = fieldOptions.validation?.rule.isRequired

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

  if (twoFactorEnabled !== false && twoFactorEnabled)
    migrationContent += `    .addColumn('two_factor_secret', 'text')\n`

  if (useBillable)
    migrationContent += `    .addColumn('stripe_id', 'text')\n`

  if (useSoftDeletes)
    migrationContent += `    .addColumn('deleted_at', 'timestamp')\n`

  if (usePasskey)
    migrationContent += `    .addColumn('public_passkey', 'text')\n`

  if (otherModelRelations?.length) {
    for (const modelRelation of otherModelRelations) {
      if (!modelRelation.foreignKey)
        continue

      migrationContent += `    .addColumn('${modelRelation.foreignKey}', 'integer', (col) =>
        col.references('${modelRelation.relationTable}.id').onDelete('cascade')
      ) \n`
    }
  }

  // Append created_at and updated_at columns if useTimestamps is true
  if (useTimestamps) {
    migrationContent
      += '    .addColumn(\'created_at\', \'timestamp\', col => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))\n'
    migrationContent += '    .addColumn(\'updated_at\', \'timestamp\')\n'
  }

  // Add execute() after all columns are defined
  migrationContent += `    .execute()\n\n`

  if (otherModelRelations?.length) {
    for (const modelRelation of otherModelRelations) {
      if (!modelRelation.foreignKey)
        continue

      migrationContent += generateForeignKeyIndexSQL(tableName, modelRelation.foreignKey)
    }
  }

  // Add composite indexes if defined
  if (model.indexes?.length) {
    migrationContent += '\n'
    for (const index of model.indexes) {
      migrationContent += generateIndexCreationSQL(tableName, index.name, index.columns)
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
      migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql\`CURRENT_TIMESTAMP\`))\n`
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

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

async function createPivotTableMigration(model: Model, modelPath: string) {
  const pivotTables = await getPivotTables(model, modelPath)

  if (!pivotTables.length)
    return

  for (const pivotTable of pivotTables) {
    const hasBeenMigrated = await checkPivotMigration(pivotTable.table)

    if (hasBeenMigrated)
      return

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

    log.success(`Created pivot migration: ${migrationFileName}`)
  }
}

async function createAlterTableMigration(modelPath: string) {
  const model = (await import(modelPath)).default as Model
  const modelName = getModelName(model, modelPath)
  const tableName = getTableName(model, modelPath)
  let hasChanged = false

  // Get the previous model to compare indexes
  const oldModelPath = path.frameworkPath(`models/${modelName}.ts`)
  const oldModel = (await import(oldModelPath)).default as Model

  // Assuming you have a function to get the fields from the last migration
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
    migrationContent += `await sql\`
        ALTER TABLE ${tableName}
        MODIFY COLUMN ${fieldNameFormatted} TEXT
      \`.execute(db)\n\n`
  }

  // Add new fields
  for (const fieldName of fieldsToAdd) {
    const options = currentFields[fieldName] as Attribute
    const columnType = mapFieldTypeToColumnType(options.validation?.rule, 'sqlite')
    const formattedFieldName = snakeCase(fieldName)
    const isRequired = options.validation?.rule.isRequired

    migrationContent += `    .addColumn('${formattedFieldName}', ${columnType}`

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

    migrationContent += `)\n\n`
  }

  // Remove fields that no longer exist
  for (const fieldName of fieldsToRemove) migrationContent += `    .dropColumn('${fieldName}')\n`

  if (fieldsToAdd.length || fieldsToRemove.length)
    migrationContent += `    .execute();\n`

  const lastFieldOrder = Object.values(lastFields).map(attr => attr.order)
  const currentFieldOrder = Object.values(currentFields).map(attr => attr.order)

  if (!isArrayEqual(lastFieldOrder, currentFieldOrder)) {
    hasChanged = true
    migrationContent += reArrangeColumns(model.attributes, tableName)
  }

  // Handle index changes
  const oldIndexes = oldModel.indexes || []
  const newIndexes = model.indexes || []

  // Drop removed indexes
  for (const oldIndex of oldIndexes) {
    if (!newIndexes.find(newIndex => newIndex.name === oldIndex.name)) {
      hasChanged = true
      migrationContent += `  await db.schema.dropIndex('${oldIndex.name}').execute()\n`
    }
  }

  // Add new indexes
  for (const newIndex of newIndexes) {
    if (!oldIndexes.find(oldIndex => oldIndex.name === newIndex.name)) {
      hasChanged = true
      migrationContent += generateIndexCreationSQL(tableName, newIndex.name, newIndex.columns)
    }
  }

  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-update-${tableName}-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  if (hasChanged) {
    Bun.write(migrationFilePath, migrationContent)
    log.success(`Created migration: ${italic(migrationFileName)}`)
  }
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
        MODIFY COLUMN ${fieldNameFormatted} TEXT NOT NULL AFTER ${snakeCase(previousField)};
      \`.execute(db)\n\n`
    }

    previousField = fieldNameFormatted
  }

  return migrationContent
}

function generateIndexCreationSQL(tableName: string, indexName: string, columns: string[]): string {
  const columnsStr = columns.map(col => `\`${snakeCase(col)}\``).join(', ')
  return `  await db.schema.createIndex('${indexName}').on('${tableName}').columns([${columnsStr}]).execute()\n`
}

function generatePrimaryKeyIndexSQL(tableName: string): string {
  return `  await db.schema.createIndex('${tableName}_id_index').on('${tableName}').column('id').execute()\n`
}

function generateForeignKeyIndexSQL(tableName: string, foreignKey: string): string {
  return `  await db.schema.createIndex('${tableName}_${foreignKey}_index').on('${tableName}').column(\`${foreignKey}\`).execute()\n\n`
}
