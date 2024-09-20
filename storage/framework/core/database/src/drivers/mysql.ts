import { italic, log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'
import { ok } from '@stacksjs/error-handling'
import { getModelName, getTableName } from '@stacksjs/orm'
import { fetchOtherModelRelations, getPivotTables } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { fs, glob, globSync } from '@stacksjs/storage'

import { snakeCase } from '@stacksjs/strings'
import type { Attribute, Attributes, Model } from '@stacksjs/types'
import {
  arrangeColumns,
  checkPivotMigration,
  fetchTables,
  findDifferingKeys,
  getLastMigrationFields,
  hasTableBeenMigrated,
  isArrayEqual,
  mapFieldTypeToColumnType,
  pluckChanges,
} from '.'

export async function resetMysqlDatabase() {
  const tables = await fetchTables()

  for (const table of tables) await db.schema.dropTable(table).ifExists().execute()

  await db.schema.dropTable('migrations').ifExists().execute()
  await db.schema.dropTable('migration_locks').ifExists().execute()

  const files = await fs.readdir(path.userMigrationsPath())
  const modelFiles = await fs.readdir(path.frameworkPath('database/models'))
  const userModelFiles = globSync([path.userModelsPath('*.ts')], { absolute: true })

  for (const userModel of userModelFiles) {
    const model = (await import(userModel)).default as Model
    const pivotTables = await getPivotTables(model, userModel)

    for (const pivotTable of pivotTables) await db.schema.dropTable(pivotTable.table).ifExists().execute()
  }

  if (modelFiles.length) {
    for (const modelFile of modelFiles) {
      if (modelFile.endsWith('.ts')) {
        const modelPath = path.frameworkPath(`database/models/${modelFile}`)

        if (fs.existsSync(modelPath)) await Bun.$`rm ${modelPath}`
      }
    }
  }

  if (files.length) {
    for (const file of files) {
      if (file.endsWith('.ts')) {
        const migrationPath = path.userMigrationsPath(`${file}`)

        if (fs.existsSync(migrationPath)) await Bun.$`rm ${migrationPath}`
      }
    }
  }

  return ok('All tables dropped successfully!')
}

export async function generateMysqlMigration(modelPath: string) {
  // check if any files are in the database folder
  const files = await fs.readdir(path.userMigrationsPath())

  // if (files.length === 0) {
  //   log.debug('No migrations found in the database folder, deleting all framework/database/*.json files...')

  //   // delete the *.ts files in the database/models folder
  //   const modelFiles = await fs.readdir(path.frameworkPath('database/models'))

  //   if (modelFiles.length) {
  //     log.debug('No existing model files in framework path...')

  //     for (const file of modelFiles) {
  //       if (file.endsWith('.ts')) await fs.unlink(path.frameworkPath(`database/models/${file}`))
  //     }
  //   }
  // }

  const model = (await import(modelPath)).default as Model
  const fileName = path.basename(modelPath)
  const tableName = getTableName(model, modelPath)

  const fieldsString = JSON.stringify(model.attributes, null, 2) // Pretty print the JSON
  const copiedModelPath = path.frameworkPath(`database/models/${fileName}`)

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
  } else {
    log.debug(`Fields have not been generated for ${tableName}`)
  }

  // store the fields of the model to a file
  await Bun.$`cp ${modelPath} ${copiedModelPath}`

  // if the fields have changed, we need to create a new update migration
  // if the fields have not changed, we need to migrate the table

  // we need to check if this tableName has already been migrated
  const hasBeenMigrated = await hasTableBeenMigrated(tableName as string)

  log.debug(`Has ${tableName} been migrated? ${hasBeenMigrated}`)

  if (haveFieldsChanged) await createAlterTableMigration(modelPath)
  else await createTableMigration(modelPath)
}

async function createTableMigration(modelPath: string) {
  log.debug('createTableMigration modelPath:', modelPath)

  const model = (await import(modelPath)).default as Model
  const tableName = getTableName(model, modelPath)

  const twoFactorEnabled =
    model.traits?.useAuth && typeof model.traits.useAuth !== 'boolean' ? model.traits.useAuth.useTwoFactor : false

  await createPivotTableMigration(model, modelPath)
  const otherModelRelations = await fetchOtherModelRelations(model, modelPath)

  const useTimestamps = model?.traits?.useTimestamps ?? model?.traits?.timestampable ?? true
  const useSoftDeletes = model?.traits?.useSoftDeletes ?? model?.traits?.softDeletable ?? false

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('${tableName}')\n`
  migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`

  for (const [fieldName, options] of arrangeColumns(model.attributes)) {
    const fieldOptions = options as Attribute
    const fieldNameFormatted = snakeCase(fieldName)
    const columnType = mapFieldTypeToColumnType(fieldOptions.validation?.rule)
    migrationContent += `    .addColumn('${fieldNameFormatted}', ${columnType}`

    // Check if there are configurations that require the lambda function
    if (fieldOptions.unique || fieldOptions?.required) {
      migrationContent += `, col => col`
      if (fieldOptions.unique) migrationContent += `.unique()`
      if (fieldOptions?.required) migrationContent += `.notNull()`
      migrationContent += ``
    }

    migrationContent += `)\n`
  }

  if (false !== twoFactorEnabled && twoFactorEnabled) {
    migrationContent += `    .addColumn('two_factor_secret', 'varchar(255)')\n`
  }

  if (otherModelRelations?.length) {
    for (const modelRelation of otherModelRelations) {
      migrationContent += `    .addColumn('${modelRelation.foreignKey}', 'integer', (col) =>
        col.references('${modelRelation.relationTable}.id').onDelete('cascade')
      ) \n`
    }
  }

  // Append created_at and updated_at columns if useTimestamps is true
  if (useTimestamps) {
    migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
    migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  }

  // Append deleted_at column if useSoftDeletes is true
  if (useSoftDeletes) migrationContent += `    .addColumn('deleted_at', 'timestamp')\n`

  migrationContent += `    .execute()\n`
  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-${tableName}-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  console.log(migrationFilePath)

  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

async function createPivotTableMigration(model: Model, modelPath: string) {
  const pivotTables = await getPivotTables(model, modelPath)

  if (!pivotTables.length) return

  for (const pivotTable of pivotTables) {
    const hasBeenMigrated = await checkPivotMigration(pivotTable.table)

    if (hasBeenMigrated) return

    let migrationContent = `import type { Database } from '@stacksjs/database'\n`
    migrationContent += `export async function up(db: Database<any>) {\n`
    migrationContent += `  await db.schema\n`
    migrationContent += `    .createTable('${pivotTable.table}')\n`
    migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`
    migrationContent += `    .addColumn('${pivotTable.firstForeignKey}', 'integer')\n`
    migrationContent += `    .addColumn('${pivotTable.secondForeignKey}', 'integer')\n`
    migrationContent += `    .execute()\n`
    migrationContent += `    }\n`

    const timestamp = new Date().getTime().toString()
    const migrationFileName = `${timestamp}-create-${pivotTable.table}-table.ts`

    const migrationFilePath = path.userMigrationsPath(migrationFileName)

    Bun.write(migrationFilePath, migrationContent)

    log.success(`Created pivot migration: ${migrationFileName}`)
  }
}

export async function createAlterTableMigration(modelPath: string) {
  console.log('createAlterTableMigration')

  const model = (await import(modelPath)).default as Model
  const modelName = getModelName(model, modelPath)
  const tableName = getTableName(model, modelPath)
  let hasChanged = false

  // Assuming you have a function to get the fields from the last migration
  // For simplicity, this is not implemented here
  const lastMigrationFields = await getLastMigrationFields(modelName)
  const lastFields = lastMigrationFields ?? {}
  const currentFields = model.attributes as Attributes

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
        MODIFY COLUMN ${fieldNameFormatted} VARCHAR(${fieldValidation.max})
      \`.execute(db)\n\n`
  }

  // Add new fields
  for (const fieldName of fieldsToAdd) {
    const options = currentFields[fieldName] as Attribute
    const columnType = mapFieldTypeToColumnType(options.validation?.rule)
    const formattedFieldName = snakeCase(fieldName)

    migrationContent += `    .addColumn('${formattedFieldName}', ${columnType}`

    // Check if there are configurations that require the lambda function
    if (options.unique || options?.required) {
      migrationContent += `, col => col`
      if (options.unique) migrationContent += `.unique()`
      if (options?.required) migrationContent += `.notNull()`
      migrationContent += ``
    }

    migrationContent += `)\n\n`
  }

  // Remove fields that no longer exist
  for (const fieldName of fieldsToRemove) migrationContent += `    .dropColumn('${fieldName}')\n`

  if (fieldsToAdd.length || fieldsToRemove.length) migrationContent += `    .execute();\n`

  const lastFieldOrder = Object.values(lastFields).map((attr) => attr.order)
  const currentFieldOrder = Object.values(currentFields).map((attr) => attr.order)

  if (!isArrayEqual(lastFieldOrder, currentFieldOrder)) {
    hasChanged = true
    migrationContent += reArrangeColumns(model.attributes, tableName)
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

function reArrangeColumns(attributes: Attributes | undefined, tableName: string): string {
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
