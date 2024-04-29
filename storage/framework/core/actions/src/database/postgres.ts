import { log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'
import { ok } from '@stacksjs/error-handling'
import { path } from '@stacksjs/path'
import { fs, glob } from '@stacksjs/storage'
import type { Attributes } from '@stacksjs/types'
import {
  checkPivotMigration,
  getLastMigrationFields,
  hasTableBeenMigrated,
  mapFieldTypeToColumnType,
} from '.'

export async function resetPostgresDatabase() {
  const tables = await fetchMysqlTables()

  for (const table of tables)
    await db.schema.dropTable(table).ifExists().execute()

  await db.schema.dropTable('migrations').ifExists().execute()
  await db.schema.dropTable('migration_locks').ifExists().execute()

  const files = await fs.readdir(path.userMigrationsPath())
  const modelFiles = await fs.readdir(path.frameworkPath('database/models'))

  const userModelFiles = glob.sync(path.userModelsPath('*.ts'))

  for (const userModel of userModelFiles) {
    const userModelPath = await import(userModel)

    const pivotTables = await getPivotTables(userModelPath)

    for (const pivotTable of pivotTables)
      await db.schema.dropTable(pivotTable.table).ifExists().execute()
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

export async function generatePostgresMigration(modelPath: string) {
  // check if any files are in the database folder
  const files = await fs.readdir(path.userMigrationsPath())

  if (files.length === 0) {
    log.debug(
      'No migrations found in the database folder, deleting all framework/database/*.json files...',
    )

    // delete the *.ts files in the database/models folder
    const modelFiles = await fs.readdir(path.frameworkPath('database/models'))

    if (modelFiles.length) {
      log.debug('No existing model files in framework path...')

      for (const file of modelFiles) {
        if (file.endsWith('.ts'))
          await fs.unlink(path.frameworkPath(`database/models/${file}`))
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
  const hasBeenMigrated = await hasTableBeenMigrated(tableName)

  log.debug(`Has ${tableName} been migrated? ${hasBeenMigrated}`)

  if (haveFieldsChanged) await createAlterTableMigration(modelPath)
  else await createTableMigration(modelPath)
}

async function createTableMigration(modelPath: string) {
  log.debug('createTableMigration modelPath:', modelPath)

  const model = await import(modelPath)
  const tableName = model.default.table

  await createPivotTableMigration(model)

  const fields = model.default.attributes
  const useTimestamps =
    model.default?.traits?.useTimestamps ?? model.default?.traits?.timestampable
  const useSoftDeletes =
    model.default?.traits?.useSoftDeletes ??
    model.default?.traits?.softDeletable

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('${tableName}')\n`
  migrationContent += `    .addColumn('id', 'serial', (col) => col.primaryKey())\n`

  for (const [fieldName, options] of Object.entries(fields)) {
    const fieldOptions = options as Attributes
    const columnType = mapFieldTypeToColumnType(fieldOptions.validator?.rule)
    migrationContent += `    .addColumn('${fieldName}', '${columnType}'`

    // Check if there are configurations that require the lambda function
    if (fieldOptions.unique || fieldOptions.validator?.rule?.required) {
      migrationContent += `, col => col`
      if (fieldOptions.unique) migrationContent += `.unique()`
      if (fieldOptions.validator?.rule?.required)
        migrationContent += `.notNull()`
      migrationContent += ``
    }

    migrationContent += `)\n`
  }

  // Append created_at and updated_at columns if useTimestamps is true
  if (useTimestamps) {
    migrationContent += `    .addColumn('created_at', 'timestamp', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
    migrationContent += `    .addColumn('updated_at', 'timestamp')\n`
  }

  // Append deleted_at column if useSoftDeletes is true
  if (useSoftDeletes)
    migrationContent += `    .addColumn('deleted_at', 'timestamp')\n`

  migrationContent += `    .execute()\n`
  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-create-${tableName}-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  // Assuming fs.writeFileSync is available or use an equivalent method
  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${migrationFileName}`)
}

async function createPivotTableMigration(model: any) {
  const pivotTables = await getPivotTables(model)

  if (!pivotTables.length) return
  for (const pivotTable of pivotTables) {
    const hasBeenMigrated = await checkPivotMigration(pivotTable.table)

    if (hasBeenMigrated) return

    let migrationContent = `import type { Database } from '@stacksjs/database'\n`
    migrationContent += `import { sql } from '@stacksjs/database'\n\n`
    migrationContent += `export async function up(db: Database<any>) {\n`
    migrationContent += `  await db.schema\n`
    migrationContent += `    .createTable('${pivotTable}')\n`
    migrationContent += `    .addColumn('id', 'serial', (col) => col.primaryKey())\n`
    migrationContent += `    .addColumn('user_id', 'integer')\n`
    migrationContent += `    .addColumn('subscriber_id', 'integer')\n`
    migrationContent += `    .execute()\n`
    migrationContent += `    }\n`

    const timestamp = new Date().getTime().toString()
    const migrationFileName = `${timestamp}-create-${pivotTable}-table.ts`
    const migrationFilePath = path.userMigrationsPath(migrationFileName)

    // Assuming fs.writeFileSync is available or use an equivalent method
    Bun.write(migrationFilePath, migrationContent)

    log.success(`Created migration: ${migrationFileName}`)
  }
}

async function getPivotTables(
  model: any,
): Promise<
  { table: string; firstForeignKey: string; secondForeignKey: string }[]
> {
  const pivotTable = []

  if ('belongsToMany' in model.default) {
    for (const belongsToManyRelation of model.default.belongsToMany) {
      const modelRelationPath = path.userModelsPath(
        `${belongsToManyRelation.model}.ts`,
      )
      const modelRelation = await import(modelRelationPath)

      const formattedModelName = model.default.name.toLowerCase()

      pivotTable.push({
        table:
          belongsToManyRelation?.pivotTable ||
          `${formattedModelName}_${modelRelation.default.table}`,
        firstForeignKey: belongsToManyRelation.firstForeignKey,
        secondForeignKey: belongsToManyRelation.secondForeignKey,
      })
    }

    return pivotTable
  }

  return []
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
    const options = currentFields[fieldName] as Attributes
    const columnType = mapFieldTypeToColumnType(options.validator?.rule)
    migrationContent += `    .addColumn('${fieldName}', '${columnType}')\n`
  }

  // Remove fields that no longer exist
  for (const fieldName of fieldsToRemove)
    migrationContent += `    .dropColumn('${fieldName}')\n`

  migrationContent += `    .execute();\n`
  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-update-${tableName}-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  // Assuming fs.writeFileSync is available or use an equivalent method
  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${migrationFileName}`)
}

export async function fetchMysqlTables(): Promise<string[]> {
  const modelFiles = glob.sync(path.userModelsPath('*.ts'))
  const tables: string[] = []

  for (const modelPath of modelFiles) {
    const model = await import(modelPath)

    const tableName = model.default.table

    tables.push(tableName)
  }

  return tables
}
