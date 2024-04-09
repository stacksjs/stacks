import { path } from '@stacksjs/path'
import { extractFieldsFromModel } from '@stacksjs/orm'
import { dim, italic, log } from '@stacksjs/cli'
import { err, ok } from '@stacksjs/error-handling'
import { fs, glob } from '@stacksjs/storage'
import type { Attribute, Attributes } from '@stacksjs/types'
import { FileMigrationProvider, Migrator } from 'kysely'
import { database } from '@stacksjs/config'
import { $ } from 'bun'
import { resetSqliteDatabase } from 'actions/src/database/sqlite'
import { resetMysqlDatabase } from 'actions/src/database/mysql'
import { db } from './utils'

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

export async function runDatabaseMigration() {
  try {
    log.info('Migrating database...')

    const migration = await migrator.migrateToLatest()

    if (migration.error) {
      log.error(migration.error)
      return err(migration.error)
    }

    if (migration.results?.length === 0) {
      log.success('No new migrations were executed')
      return ok('No new migrations were executed')
    }

    if (migration.results) {
      migration.results.forEach(({ migrationName }) => {
        // eslint-disable-next-line no-console
        console.log(italic(`${dim(`   - Migration Name:`)} ${migrationName}`))
      })

      log.success('Database migrated successfully.')
      return ok(migration)
    }

    log.success('Database migration completed with no new migrations.')
    return ok('Database migration completed with no new migrations.')
  }
  catch (error) {
    console.error('Migration failed:', error)
    return err(error)
  }
}

export interface MigrationOptions {
  name: string
  up: string
}

export async function resetDatabase() {
  const driver = database.default || ''

  if (driver === 'sqlite')
    return resetSqliteDatabase()

  if (['mysql', 'postgres'].includes(driver))
    return resetMysqlDatabase()

  return resetSqliteDatabase()
}

export function generateMigrationFile(options: MigrationOptions) {
  const { name, up } = options

  const timestamp = new Date().getTime().toString()
  const fileName = `${timestamp}-${name}.ts`
  const filePath = path.userMigrationsPath(fileName)
  const fileContent = `import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  ${up}
})`

  Bun.write(filePath, fileContent)

  log.success(`Created migration: ${fileName}`)
}

export async function generateMigrations() {
  try {
    log.info('Generating migrations...')

    const modelFiles = glob.sync(path.userModelsPath('*.ts'))

    for (const file of modelFiles) {
      log.info('Generating migration for:', file)
      await generateMigration(file)
    }

    log.success('Migrations generated successfully.')
    return ok('Migrations generated successfully.')
  }
  catch (error) {
    return err(error)
  }
}

export async function generateMigration(modelPath: string) {
  // check if any files are in the database folder
  const files = await fs.readdir(path.userMigrationsPath())

  if (files.length === 0) {
    log.debug('No migrations found in the database folder, deleting all framework/database/*.json files...')

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

  if (haveFieldsChanged)
    await createAlterTableMigration(modelPath)
  else
    await createTableMigration(modelPath)
}

function mapFieldTypeToColumnType(rule: any): string {
  // Check if the rule is for a string and has specific validations
  if (rule[Symbol.for('schema_name')].includes('string'))
    // Default column type for strings
    return prepareTextColumnType(rule)

  if (rule[Symbol.for('schema_name')].includes('number'))
    return 'int'

  if (rule[Symbol.for('schema_name')].includes('boolean'))
    return 'boolean'

  if (rule[Symbol.for('schema_name')].includes('date'))
    return 'date'

  // need to now handle all other types

  // Add cases for other types as needed, similar to the original function
  switch (rule) {
    case 'integer':
      return 'int'
    case 'boolean':
      return 'boolean'
    case 'date':
      return 'date'
    case 'datetime':
      return 'timestamp'
    case 'float':
      return 'float'
    case 'decimal':
      return 'decimal'
    default:
      return 'text' // Fallback for unknown types
  }
}

function prepareTextColumnType(rule) {
  let columnType = 'varchar(255)'

  // Find min and max length validations
  const minLengthValidation = rule.validations.find(v => v.options?.min !== undefined)
  const maxLengthValidation = rule.validations.find(v => v.options?.max !== undefined)

  // If there's a max length validation, adjust the column type accordingly
  if (maxLengthValidation) {
    const maxLength = maxLengthValidation.options.max
    columnType = `varchar(${maxLength})`
  }

  // If there's only a min length validation and no max, consider using text
  // This is a simplistic approach; adjust based on your actual requirements
  if (minLengthValidation && !maxLengthValidation)
    columnType = 'text'

  return columnType
}

export async function getExecutedMigrations() {
  try {
    // @ts-expect-error the migrations table is not typed yet
    return await db.selectFrom('migrations').select('name').execute()
  }
  catch (error) {
    return []
  }
}

export async function hasTableBeenMigrated(tableName: string) {
  log.debug(`hasTableBeenMigrated for table: ${tableName}`)

  const results = await getExecutedMigrations()

  return results.some(migration => migration.name.includes(tableName))
}

export async function haveModelFieldsChangedSinceLastMigration(modelPath: string) {
  log.debug(`haveModelFieldsChangedSinceLastMigration for model: ${modelPath}`)

  // const model = await import(modelPath)
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
  }
  catch (error) {
    console.error('Failed to get last migration:', error)
    return { error }
  }
}

export async function lastMigrationDate(): Promise<string | undefined> {
  try {
    // @ts-expect-error the migrations table is not typed yet
    return (await db.selectFrom('migrations').select('timestamp').orderBy('timestamp', 'desc').limit(1).execute())[0].timestamp
  }
  catch (error) {
    console.error('Failed to get last migration date:', error)
    return undefined
  }
}

export async function createAlterTableMigration(modelPath: string) {
  // eslint-disable-next-line no-console
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

// This is a placeholder function. You need to implement the logic to
// read the last migration file and extract the fields that were modified.
export async function getLastMigrationFields(modelName: string): Promise<Attribute> {
  const oldModelPath = path.frameworkPath(`database/models/${modelName}`)
  const model = await import(oldModelPath)
  let fields = {} as Attributes

  if (typeof model.default.attributes === 'object')
    fields = model.default.attributes
  else
    fields = JSON.parse(model.default.attributes) as Attributes

  return fields
}

export async function getCurrentMigrationFields(modelPath: string): Promise<Attribute | undefined> {
  return extractFieldsFromModel(modelPath)
}

export async function createTableMigration(modelPath: string) {
  log.debug('createTableMigration modelPath:', modelPath)

  const model = await import(modelPath)
  const tableName = model.default.table

  const fields = model.default.attributes
  const useTimestamps = model.default?.traits?.useTimestamps ?? model.default?.traits?.timestampable
  const useSoftDeletes = model.default?.traits?.useSoftDeletes ?? model.default?.traits?.softDeletable

  let migrationContent = `import type { Database } from '@stacksjs/database'\n`
  migrationContent += `import { sql } from '@stacksjs/database'\n\n`
  migrationContent += `export async function up(db: Database<any>) {\n`
  migrationContent += `  await db.schema\n`
  migrationContent += `    .createTable('${tableName}')\n`

  for (const [fieldName, options] of Object.entries(fields)) {
    const fieldOptions = options as Attributes
    const columnType = mapFieldTypeToColumnType(fieldOptions.validator?.rule)
    migrationContent += `    .addColumn('${fieldName}', '${columnType}'`

    // Check if there are configurations that require the lambda function
    if (fieldOptions.unique || (fieldOptions.validator?.rule?.required)) {
      migrationContent += `, col => col`
      if (fieldOptions.unique)
        migrationContent += `.unique()`
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
