import type { Ok } from '@stacksjs/error-handling'
import type { Attribute, AttributesElements, Model } from '@stacksjs/types'
import { italic, log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'
import { ok } from '@stacksjs/error-handling'
import { fetchOtherModelRelations, getPivotTables, getTableName } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'
import { snakeCase } from '@stacksjs/strings'
import {
  arrangeColumns,
  checkPivotMigration,
  getLastMigrationFields,
  hasTableBeenMigrated,
  mapFieldTypeToColumnType,
  pluckChanges,
} from '.'
import { createPostgresPasskeyMigration, createPostgresCategoriesTable, createPostgresCommentsTable } from './traits'

export async function resetPostgresDatabase(): Promise<Ok<string, never>> {
  const tables = await fetchPostgresTables()

  for (const table of tables) await db.schema.dropTable(table).ifExists().execute()

  await db.schema.dropTable('migrations').ifExists().execute()
  await db.schema.dropTable('migration_locks').ifExists().execute()

  const files = await fs.readdir(path.userMigrationsPath())
  const modelFiles = await fs.readdir(path.frameworkPath('models'))

  const userModelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/models/**/*.ts')], { absolute: true })

  for (const userModel of userModelFiles) {
    const userModelPath = (await import(userModel)).default

    const pivotTables = await getPivotTables(userModelPath, userModelPath)

    for (const pivotTable of pivotTables) await db.schema.dropTable(pivotTable.table).ifExists().execute()
  }

  if (modelFiles.length) {
    for (const modelFile of modelFiles) {
      if (modelFile.endsWith('.ts')) {
        const modelPath = path.frameworkPath(`models/${modelFile}`)

        if (fs.existsSync(modelPath))
          await Bun.$`rm ${modelPath}`
      }
    }
  }

  if (files.length) {
    for (const file of files) {
      if (file.endsWith('.ts')) {
        const migrationPath = path.userMigrationsPath(`${file}`)

        if (fs.existsSync(migrationPath))
          await Bun.$`rm ${migrationPath}`
      }
    }
  }

  return ok('All tables dropped successfully!')
}

export async function generatePostgresMigration(modelPath: string): Promise<void> {
  // check if any files are in the database folder
  const files = await fs.readdir(path.userMigrationsPath())

  if (files.length === 0) {
    log.debug('No migrations found in the database folder, deleting all framework/database/*.json files...')

    // delete the *.ts files in the models folder
    const modelFiles = await fs.readdir(path.frameworkPath('models'))

    if (modelFiles.length) {
      log.debug('No existing model files in framework path...')

      for (const file of modelFiles) {
        if (file.endsWith('.ts'))
          await fs.unlink(path.frameworkPath(`models/${file}`))
      }
    }
  }

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
  const hasBeenMigrated = await hasTableBeenMigrated(tableName)

  log.debug(`Has ${tableName} been migrated? ${hasBeenMigrated}`)

  const usePasskey = (typeof model.traits?.useAuth === 'object' && model.traits.useAuth.usePasskey) ?? false
  const useBillable = model.traits?.billable || false
  const useUuid = model.traits?.useUuid || false

  // Create categories table if model is categorizable and has proper configuration
  if (model.traits?.categorizable && typeof model.traits.categorizable === 'object') {
    await createPostgresCategoriesTable()
  }

  if (usePasskey)
    await createPostgresPasskeyMigration()

  if (model.traits?.commentable && typeof model.traits.commentable === 'object') {
    await createPostgresCommentsTable()
  }

  if (useBillable && tableName === 'users')
    await createTableMigration(path.storagePath('framework/models/generated/Subscription.ts'))

  if (haveFieldsChanged)
    await createAlterTableMigration(modelPath)
  else await createTableMigration(modelPath)
}

async function createTableMigration(modelPath: string) {
  log.debug('createTableMigration modelPath:', modelPath)

  const model = (await import(modelPath)).default as Model
  const tableName = getTableName(model, modelPath)

  await createPivotTableMigration(model, modelPath)

  const otherModelRelations = await fetchOtherModelRelations(modelPath)
  const useTimestamps = model.traits?.useTimestamps ?? model.traits?.timestampable ?? true
  const useSoftDeletes = model.traits?.useSoftDeletes ?? model.traits?.softDeletable ?? false

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('${tableName}')\n`
  migrationContent += `    .addColumn('id', 'serial', (col) => col.primaryKey())\n`

  for (const [fieldName, options] of arrangeColumns(model.attributes)) {
    const fieldOptions = options as Attribute
    const fieldNameFormatted = snakeCase(fieldName)
    const columnType = mapFieldTypeToColumnType(fieldOptions.validation?.rule)
    migrationContent += `    .addColumn('${fieldNameFormatted}', '${columnType}'`

    // Check if there are configurations that require the lambda function
    if (fieldOptions.unique || fieldOptions.validation?.rule?.required || fieldOptions.default !== undefined) {
      migrationContent += `, col => col`
      if (fieldOptions.unique)
        migrationContent += `.unique()`
      if (fieldOptions.validation?.rule?.required)
        migrationContent += `.notNull()`
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
  if (useSoftDeletes)
    migrationContent += `    .addColumn('deleted_at', 'timestamp')\n`

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
    migrationContent += `    .addColumn('id', 'serial', (col) => col.primaryKey())\n`
    migrationContent += `    .addColumn('${pivotTable.firstForeignKey}', 'integer', (col) => col.notNull())\n`
    migrationContent += `    .addColumn('${pivotTable.secondForeignKey}', 'integer', (col) => col.notNull())\n`
    migrationContent += `    .addColumn('created_at', 'timestamp with time zone', col => col.notNull().defaultTo(sql.raw('CURRENT_TIMESTAMP')))\n`
    migrationContent += `    .execute()\n\n`

    // Add foreign key constraints
    migrationContent += `  await db.schema\n`
    migrationContent += `    .alterTable('${pivotTable.table}')\n`
    migrationContent += `    .addForeignKeyConstraint('${pivotTable.table}_${pivotTable.firstForeignKey}_fkey', ['${pivotTable.firstForeignKey}'], '${pivotTable.table.split('_')[0]}', ['id'], (cb) => cb.onDelete('cascade'))\n`
    migrationContent += `    .addForeignKeyConstraint('${pivotTable.table}_${pivotTable.secondForeignKey}_fkey', ['${pivotTable.secondForeignKey}'], '${pivotTable.table.split('_')[1]}', ['id'], (cb) => cb.onDelete('cascade'))\n`
    migrationContent += `    .execute()\n\n`

    // Add unique constraint to prevent duplicate relationships
    migrationContent += `  await db.schema\n`
    migrationContent += `    .alterTable('${pivotTable.table}')\n`
    migrationContent += `    .addUniqueConstraint('${pivotTable.table}_unique', ['${pivotTable.firstForeignKey}', '${pivotTable.secondForeignKey}'])\n`
    migrationContent += `    .execute()\n\n`

    // Add indexes for better query performance
    migrationContent += `  await db.schema\n`
    migrationContent += `    .createIndex('${pivotTable.table}_${pivotTable.firstForeignKey}_idx')\n`
    migrationContent += `    .on('${pivotTable.table}')\n`
    migrationContent += `    .column('${pivotTable.firstForeignKey}')\n`
    migrationContent += `    .execute()\n\n`

    migrationContent += `  await db.schema\n`
    migrationContent += `    .createIndex('${pivotTable.table}_${pivotTable.secondForeignKey}_idx')\n`
    migrationContent += `    .on('${pivotTable.table}')\n`
    migrationContent += `    .column('${pivotTable.secondForeignKey}')\n`
    migrationContent += `    .execute()\n`

    migrationContent += `}\n`

    const timestamp = new Date().getTime().toString()
    const migrationFileName = `${timestamp}-create-${pivotTable.table}-table.ts`
    const migrationFilePath = path.userMigrationsPath(migrationFileName)

    Bun.write(migrationFilePath, migrationContent)

    // Mark this pivot table as processed
    processedPivotTables.add(pivotTable.table)

    log.success(`Created migration: ${italic(migrationFileName)}`)
  }
}

async function createAlterTableMigration(modelPath: string) {
  const model = (await import(modelPath)).default as Model
  const modelName = path.basename(modelPath)
  const tableName = getTableName(model, modelPath)

  // Assuming you have a function to get the fields from the last migration
  // For simplicity, this is not implemented here
  const lastMigrationFields = await getLastMigrationFields(modelName)
  const lastFields = lastMigrationFields ?? {}
  const currentFields = model.attributes as AttributesElements
  const changes = pluckChanges(Object.keys(lastFields), Object.keys(currentFields))
  const fieldsToAdd = changes?.added || []
  const fieldsToRemove = changes?.removed || []

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema.alterTable('${tableName}')\n`

  // Add new fields
  for (const fieldName of fieldsToAdd) {
    const options = currentFields[fieldName] as Attribute
    const columnType = mapFieldTypeToColumnType(options.validation?.rule)
    const formattedFieldName = snakeCase(fieldName)

    migrationContent += `    .addColumn('${formattedFieldName}', '${columnType}'`

    // Check if there are configurations that require the lambda function
    if (options.unique || options.validation?.rule?.required || options.default !== undefined) {
      migrationContent += `, col => col`
      if (options.unique)
        migrationContent += `.unique()`
      if (options.validation?.rule?.required)
        migrationContent += `.notNull()`
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

  migrationContent += `    .execute();\n`
  migrationContent += `}\n`

  const timestamp = new Date().getTime().toString()
  const migrationFileName = `${timestamp}-update-${tableName}-table.ts`
  const migrationFilePath = path.userMigrationsPath(migrationFileName)

  // Assuming fs.writeFileSync is available or use an equivalent method
  Bun.write(migrationFilePath, migrationContent)

  log.success(`Created migration: ${italic(migrationFileName)}`)
}

export async function fetchPostgresTables(): Promise<string[]> {
  const modelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/models/**/*.ts')])
  const tables: string[] = []

  for (const modelPath of modelFiles) {
    const model = (await import(modelPath)).default
    const tableName = getTableName(model, modelPath)

    tables.push(tableName)
  }

  return tables
}
