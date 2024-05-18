import { italic, log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'
import { ok } from '@stacksjs/error-handling'
import { modelTableName } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { fs, glob } from '@stacksjs/storage'
import { pluralize, snakeCase } from '@stacksjs/strings'
import type { Attribute, Attributes, Model } from '@stacksjs/types'
import { checkPivotMigration, fetchOtherModelRelations, getLastMigrationFields, hasTableBeenMigrated, mapFieldTypeToColumnType } from '.'

export async function resetSqliteDatabase() {
  const dbPath = path.userDatabasePath('stacks.sqlite')

  if (fs.existsSync(dbPath)) await Bun.$`rm ${dbPath}`

  const files = await fs.readdir(path.userMigrationsPath())
  const modelFiles = await fs.readdir(path.frameworkPath('database/models'))

  const userModelFiles = glob.sync(path.userModelsPath('*.ts'))

  for (const userModel of userModelFiles) {
    const userModelPath = await import(userModel)

    const pivotTables = await getPivotTables(userModelPath)

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

      for (const file of modelFiles) {
        if (file.endsWith('.ts')) await fs.unlink(path.frameworkPath(`database/models/${file}`))
      }
    }
  }

  const model = await import(modelPath)
  const fileName = path.basename(modelPath)
  const tableName = model.default.table

  const fieldsString = JSON.stringify(model.default.attributes, null, 2) // Pretty print the JSON
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

async function getPivotTables(
  model: Model,
): Promise<{ table: string; firstForeignKey: string | undefined; secondForeignKey: string | undefined }[]> {
  const pivotTable = []

  if (model.belongsToMany && model.name) {
    if ('belongsToMany' in model) {
      for (const belongsToManyRelation of model.belongsToMany) {
        const modelRelationPath = path.userModelsPath(`${belongsToManyRelation.model}.ts`)
        const modelRelation = (await import(modelRelationPath)).default
        const formattedModelName = model.name.toLowerCase()

        pivotTable.push({
          table: belongsToManyRelation?.pivotTable || `${formattedModelName}_${modelRelation.table}`,
          firstForeignKey: belongsToManyRelation.firstForeignKey,
          secondForeignKey: belongsToManyRelation.secondForeignKey,
        })
      }

      return pivotTable
    }
  }

  return []
}

async function createTableMigration(modelPath: string): Promise<void> {
  log.debug('createTableMigration modelPath:', modelPath)

  const model = (await import(modelPath)).default as Model
  const tableName = await modelTableName(model)

  await createPivotTableMigration(model)
  const modelFiles = glob.sync(path.userModelsPath('*.ts'))

  const otherModelRelations = await fetchOtherModelRelations(model, modelFiles)

  const fields = model.attributes as Attributes
  const useTimestamps = model?.traits?.useTimestamps ?? model?.traits?.timestampable
  const useSoftDeletes = model?.traits?.useSoftDeletes ?? model?.traits?.softDeletable

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('${tableName}')\n`
  migrationContent += `    .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())\n`

  for (const [fieldName, options] of Object.entries(fields)) {
    const fieldOptions = options as Attribute
    const columnType = mapFieldTypeToColumnType(fieldOptions.validator?.rule)
    migrationContent += `    .addColumn('${fieldName}', '${columnType}'`

    // Check if there are configurations that require the lambda function
    if (fieldOptions.unique || fieldOptions.validator?.rule?.required) {
      migrationContent += `, col => col`
      if (fieldOptions.unique) migrationContent += `.unique()`
      if (fieldOptions.validator?.rule?.required) migrationContent += `.notNull()`
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

async function createPivotTableMigration(model: Model) {
  const pivotTables = await getPivotTables(model)

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
    const migrationFileName = `${timestamp}-create-${pivotTable}-table.ts`
    const migrationFilePath = path.userMigrationsPath(migrationFileName)

    // Assuming fs.writeFileSync is available or use an equivalent method
    Bun.write(migrationFilePath, migrationContent)

    log.success(`Created pivot migration: ${migrationFileName}`)
  }
}

export async function createAlterTableMigration(modelPath: string) {
  console.log('createAlterTableMigration')

  const model = await import(modelPath)
  const modelName = path.basename(modelPath)
  const tableName = model.default.table

  // Assuming you have a function to get the fields from the last migration
  // For simplicity, this is not implemented here
  const lastMigrationFields = await getLastMigrationFields(modelName)
  const lastFields = lastMigrationFields ?? {}
  const currentFields = model.default.attributes as Attributes

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
    const columnType = mapFieldTypeToColumnType(options.validator?.rule)
    migrationContent += `    .addColumn('${fieldName}', '${columnType}')\n`
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
