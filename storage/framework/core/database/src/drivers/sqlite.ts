import { italic, log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'
import { ok } from '@stacksjs/error-handling'
import { getModelName, getTableName } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { fs, glob } from '@stacksjs/storage'
import { snakeCase } from '@stacksjs/strings'
import type { Attribute, Attributes, Model } from '@stacksjs/types'
import {
  checkPivotMigration,
  fetchOtherModelRelations,
  getLastMigrationFields,
  getPivotTables,
  hasTableBeenMigrated,
  mapFieldTypeToColumnType,
} from '.'

export async function resetSqliteDatabase() {
  const dbPath = path.userDatabasePath('stacks.sqlite')

  if (fs.existsSync(dbPath)) await Bun.$`rm ${dbPath}`

  const files = await fs.readdir(path.userMigrationsPath())
  const modelFiles = await fs.readdir(path.frameworkPath('database/models'))

  const userModelFiles = glob.sync(path.userModelsPath('*.ts'))

  for (const userModel of userModelFiles) {
    const userModelPath = (await import(userModel)).default

    const pivotTables = await getPivotTables(userModelPath, userModel)

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

export async function generateSqliteMigration(modelPath: string) {
  // check if any files are in the database folder
  const files = await fs.readdir(path.userMigrationsPath())

  if (files.length === 0) {
    log.debug('No migrations found in the database folder, deleting all framework/database/*.json files...')

    // delete the *.ts files in the database/models folder
    const modelFiles = await fs.readdir(path.frameworkPath('database/models'))

    if (modelFiles.length) {
      log.debug('No existing model files in framework path...')

      for (const file of modelFiles)
        if (file.endsWith('.ts')) await fs.unlink(path.frameworkPath(`database/models/${file}`))
    }
  }

  const model = (await import(modelPath)).default as Model
  const fileName = path.basename(modelPath)
  const tableName = await getTableName(model, modelPath)

  const fieldsString = JSON.stringify(model.attributes, null, 2) // Pretty print the JSON
  const copiedModelPath = path.frameworkPath(`database/models/${fileName}`)

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
  } else {
    log.debug(`Fields have not been generated for ${tableName}`)
  }

  // store the fields of the model to a file
  await Bun.$`cp ${modelPath} ${copiedModelPath}`

  // if the fields have changed, we need to create a new update migration
  // if the fields have not changed, we need to migrate the table

  // we need to check if this tableName has already been migrated
  const hasBeenMigrated = await hasTableBeenMigrated(tableName)

  log.debug(`Has ${tableName} been migrated? ${hasBeenMigrated}`)

  if (haveFieldsChanged) await createAlterTableMigration(modelPath)
  else await createTableMigration(modelPath)
}

async function createTableMigration(modelPath: string): Promise<void> {
  log.debug('createTableMigration modelPath:', modelPath)

  const model = (await import(modelPath)).default as Model
  const tableName = await getTableName(model, modelPath)

  await createPivotTableMigration(model, modelPath)
  const otherModelRelations = await fetchOtherModelRelations(model, modelPath)
  const fields = model.attributes
  const useTimestamps = model?.traits?.useTimestamps ?? model?.traits?.timestampable ?? true
  const useSoftDeletes = model?.traits?.useSoftDeletes ?? model?.traits?.softDeletable ?? false

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('${tableName}')\n`
  migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`

  for (const [fieldName, options] of Object.entries(fields)) {
    const fieldOptions = options as Attribute
    const columnType = mapFieldTypeToColumnType(fieldOptions.validations?.rule)
    migrationContent += `    .addColumn('${fieldName}', '${columnType}'`

    // Check if there are configurations that require the lambda function
    if (fieldOptions.unique || fieldOptions.validations?.rule?.required) {
      migrationContent += `, col => col`
      if (fieldOptions.unique) migrationContent += `.unique()`
      if (fieldOptions.validations?.rule?.required) migrationContent += `.notNull()`
      migrationContent += ``
    }

    migrationContent += `)\n`
  }

  if (otherModelRelations?.length) {
    for (const modelRelation of otherModelRelations) {
      migrationContent += `    .addColumn('${modelRelation.foreignKey}', 'integer', (col) =>
        col.references('${modelRelation.relationTable}.id').onDelete('cascade').notNull()
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

  // Assuming fs.writeFileSync is available or use an equivalent method
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

    // Assuming fs.writeFileSync is available or use an equivalent method
    Bun.write(migrationFilePath, migrationContent)

    log.success(`Created pivot migration: ${migrationFileName}`)
  }
}

export async function createAlterTableMigration(modelPath: string) {
  console.log('createAlterTableMigration')

  const model = (await import(modelPath)).default as Model
  const modelName = getModelName(model, modelPath)
  const tableName = await getTableName(model, modelPath)

  // Assuming you have a function to get the fields from the last migration
  // For simplicity, this is not implemented here
  const lastMigrationFields = await getLastMigrationFields(modelName)
  const lastFields = lastMigrationFields ?? {}
  const currentFields = model.attributes as Attributes

  // Determine fields to add and remove
  const fieldsToAdd = Object.keys(currentFields)
  const fieldsToRemove = Object.keys(lastFields)

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema.alterTable('${tableName}')\n`

  // Add new fields
  for (const fieldName of fieldsToAdd) {
    const options = currentFields[fieldName] as Attribute
    const fieldNameFormatted = snakeCase(fieldName)

    const columnType = mapFieldTypeToColumnType(options.validations?.rule)
    migrationContent += `    .addColumn('${fieldNameFormatted}', '${columnType}')\n`
  }

  // Remove fields that no longer exist
  for (const fieldName of fieldsToRemove) migrationContent += `    .dropColumn('${fieldName}')\n`

  migrationContent += `    .execute();\n`
  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-update-${tableName}-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  // Assuming fs.writeFileSync is available or use an equivalent method
  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}
